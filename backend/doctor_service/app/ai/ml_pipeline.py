# doctor_service/app/ai/ml_pipeline.py
# VERSION FOCUSED ONLY ON LOADING AND PREDICTION

# --- Core Imports ---
import numpy as np
import pandas as pd
import joblib
import warnings
import logging
import random
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Union, Optional, Tuple, Any, Set, Type

# --- Scikit-learn Imports ---
from sklearn.preprocessing import (
    StandardScaler, OneHotEncoder, LabelEncoder, 
    KBinsDiscretizer, OrdinalEncoder
)
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.utils.validation import check_is_fitted
from sklearn.exceptions import NotFittedError

# --- Optional ML Libraries ---
print("--- Checking Library Imports (ml_pipeline.py - backend v5) ---")
try:
    import lightgbm as lgb
    from lightgbm import LGBMClassifier
    # LGBMNotFittedError doesn't exist, use sklearn's NotFittedError instead
    print(f"✅ (ml_pipeline.py) LightGBM version: {lgb.__version__}")
    LIGHTGBM_AVAILABLE = True
except ImportError as e:
    LGBMClassifier = None
    LIGHTGBM_AVAILABLE = False
    print(f"❌ (ml_pipeline.py) LightGBM unavailable: {str(e)}")

try:
    from xgboost import XGBClassifier
    import xgboost as xgb
    print(f"✅ (ml_pipeline.py) XGBoost version: {xgb.__version__}")
    XGBOOST_AVAILABLE = True
except ImportError as e:
    XGBClassifier = None
    XGBOOST_AVAILABLE = False
    print(f"❌ (ml_pipeline.py) XGBoost unavailable: {str(e)}")

try:
    import catboost as cb
    CatBoostClassifier = cb.CatBoostClassifier
    print(f"✅ (ml_pipeline.py) CatBoost version: {cb.__version__}")
    CATBOOST_AVAILABLE = True
except ImportError as e:
    CatBoostClassifier = None
    CATBOOST_AVAILABLE = False
    print(f"❌ (ml_pipeline.py) CatBoost unavailable: {str(e)}")

try:
    import shap
    print(f"✅ (ml_pipeline.py) SHAP version: {shap.__version__}")
    SHAP_AVAILABLE = True
except ImportError as e:
    shap = None
    SHAP_AVAILABLE = False
    print(f"❌ (ml_pipeline.py) SHAP unavailable: {str(e)}")

print("--- Library Import Check Done (ml_pipeline.py) ---")

# --- Configuration ---
_THIS_DIR = Path(__file__).parent
MODELS_DIR = _THIS_DIR / "models"  # Base directory for loading models inside app/ai/
RANDOM_STATE = 42

# --- Setup ---
MODELS_DIR.mkdir(exist_ok=True)
logger = logging.getLogger("ClinicalAI_Pipeline")

# Configure warnings
warnings.filterwarnings('ignore', category=UserWarning, module='sklearn')
warnings.filterwarnings('ignore', category=FutureWarning, module='sklearn')
warnings.filterwarnings('ignore', category=pd.errors.PerformanceWarning)

# Set random seeds for reproducibility
np.random.seed(RANDOM_STATE)
random.seed(RANDOM_STATE)


class ClinicalFeatureTransformer(BaseEstimator, TransformerMixin):
    """
    Transforms raw clinical data into a richer feature set for modeling.
    """
    
    def __init__(
        self, 
        temporal_features: bool = True, 
        interaction_features: bool = True,
        symptom_clusters: bool = True, 
        risk_stratification: bool = True
    ):
        self.temporal_features = temporal_features
        self.interaction_features = interaction_features
        self.symptom_clusters = symptom_clusters
        self.risk_stratification = risk_stratification
        self._feature_names_out: Optional[List[str]] = None
        self._raw_feature_names_in: Optional[List[str]] = None
        self.is_fitted_ = False

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> 'ClinicalFeatureTransformer':
        self._raw_feature_names_in = list(X.columns)
        try:
            X_sample = X.head(1).fillna(0)
            X_transformed_mock = self._transform_logic(X_sample)
            self._feature_names_out = list(X_transformed_mock.columns)
            self.is_fitted_ = True
            logger.debug(f"CFT fitted. In:{len(self._raw_feature_names_in)}, Out:{len(self._feature_names_out)}")
        except Exception as e:
            logger.error(f"Error during CFT fit: {e}", exc_info=True)
            self._feature_names_out = self._raw_feature_names_in
            logger.warning("CFT fit error, using raw names.")
            self.is_fitted_ = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        check_is_fitted(self, 'is_fitted_')
        if self._raw_feature_names_in is None:
            raise NotFittedError("CFT not fitted.")
            
        X_processed = X.copy()
        
        # Handle missing columns
        missing_cols = set(self._raw_feature_names_in) - set(X.columns)
        for col in missing_cols:
            X_processed.loc[:, col] = 0
            
        # Remove extra columns
        extra_cols = set(X.columns) - set(self._raw_feature_names_in)
        X_processed = X_processed.drop(columns=list(extra_cols), errors='ignore')
        
        try:
            X_processed = X_processed[self._raw_feature_names_in]
        except KeyError as e:
            logger.error(f"CFT Column mismatch: {e}.", exc_info=True)
            raise ValueError(f"Input columns mismatch: {e}") from e
            
        return self._transform_logic(X_processed)

    def _transform_logic(self, X: pd.DataFrame) -> pd.DataFrame:
        X_transformed = X.copy()
        
        try:
            # Extract symptom and comorbidity columns
            symptom_cols = [c for c in X.columns if c.startswith('symptom_')]
            comorbidity_cols = [c for c in X.columns if c.startswith('comorbidity_')]
            
            # Basic counts and severity
            X_transformed['symptom_count'] = X_transformed[symptom_cols].fillna(0).sum(axis=1)
            X_transformed['comorbidity_count'] = X_transformed[comorbidity_cols].fillna(0).sum(axis=1)
            
            if len(symptom_cols) > 0:
                X_transformed['symptom_severity_normalized'] = (X_transformed['symptom_count'] / len(symptom_cols) * 100)
            else:
                X_transformed['symptom_severity_normalized'] = 0
                
            duration = X_transformed.get('symptom_duration_days', pd.Series(1, index=X.index)).replace(0, 1).fillna(1)
            X_transformed['symptom_density'] = X_transformed['symptom_count'] / duration
            
            # Temporal features
            if self.temporal_features:
                onset_days = X_transformed.get('symptom_onset_days', pd.Series(0.5, index=X.index)).replace(0, 0.5).fillna(0.5)
                X_transformed['symptom_velocity'] = X_transformed['symptom_count'] / onset_days
                X_transformed['acute_onset'] = (onset_days <= 3).astype(int)
                X_transformed['progression_rate'] = X_transformed['symptom_severity_normalized'].fillna(0) / duration
                worsening = X_transformed.get('symptoms_worsening', 0).fillna(0)
                X_transformed['rapid_deterioration'] = ((worsening == 1) & (duration <= 3)).astype(int)
            
            # Symptom clusters
            if self.symptom_clusters:
                symptom_groups = {
                    'respiratory': ['cough', 'difficulty_breathing', 'chest_pain', 'wheezing', 'sore_throat'],
                    'gi': ['nausea', 'vomiting', 'diarrhea', 'abdominal_pain', 'loss_of_appetite'],
                    'neuro': ['headache', 'confusion', 'dizziness', 'neck_stiffness', 'seizure', 'sensitivity_to_light'],
                    'systemic': ['fever', 'fatigue', 'chills', 'weight_loss', 'night_sweats', 'body_aches', 'sweating']
                }
                
                for group, symptoms in symptom_groups.items():
                    present = [f'symptom_{s}' for s in symptoms if f'symptom_{s}' in X.columns]
                    if present:
                        X_transformed[f'{group}_cluster'] = X_transformed[present].fillna(0).sum(axis=1) / len(present)
                    else:
                        X_transformed[f'{group}_cluster'] = 0
                
                # Specific disease patterns
                core = {'fever', 'headache', 'neck_stiffness'}
                present_core = [f'symptom_{s}' for s in core if f'symptom_{s}' in X.columns]
                
                if len(present_core) == len(core):
                    all_present = (X_transformed[present_core[0]].fillna(0) == 1)
                    for col in present_core[1:]:
                        all_present = all_present & (X_transformed[col].fillna(0) == 1)
                    X_transformed['meningitis_pattern'] = all_present.astype(int)
                else:
                    X_transformed['meningitis_pattern'] = 0
            
            # Interaction features
            if self.interaction_features:
                age = X_transformed.get('age', 30).fillna(30)
                X_transformed['is_child'] = (age < 5).astype(int)
                X_transformed['is_elderly'] = (age > 65).astype(int)
                
                for sym in ['fever', 'difficulty_breathing']:
                    sym_col = f'symptom_{sym}'
                    X_transformed[f'{sym}_child'] = X_transformed.get(sym_col, 0).fillna(0) * X_transformed['is_child']
                    X_transformed[f'{sym}_elderly'] = X_transformed.get(sym_col, 0).fillna(0) * X_transformed['is_elderly']
                
                X_transformed['comorbidity_severity_interaction'] = (
                    X_transformed['comorbidity_count'] * 
                    X_transformed['symptom_severity_normalized'].fillna(0)
                )
                
                # Key symptom combinations
                for s1, s2 in [('fever', 'chills'), ('fever', 'neck_stiffness'), ('cough', 'blood_in_sputum')]:
                    X_transformed[f'{s1}_{s2}_combo'] = (
                        X_transformed.get(f'symptom_{s1}', 0).fillna(0) * 
                        X_transformed.get(f'symptom_{s2}', 0).fillna(0)
                    )
            
            # Risk stratification
            if self.risk_stratification:
                hr = X_transformed.get('vital_heart_rate', 75).fillna(75)
                rr = X_transformed.get('vital_respiratory_rate', 16).fillna(16)
                temp = X_transformed.get('vital_temperature', 37.0).fillna(37.0)
                o2 = X_transformed.get('vital_oxygen_saturation', 98).fillna(98)
                
                # SIRS criteria (Systemic Inflammatory Response Syndrome)
                sirs = (hr > 90).astype(int) + (rr > 20).astype(int) + ((temp < 36) | (temp > 38)).astype(int)
                X_transformed['sirs_score'] = sirs
                X_transformed['sepsis_risk_flag'] = (sirs >= 2).astype(int)
                
                # Dehydration risk
                dehyd = (
                    (X_transformed.get('symptom_diarrhea', 0).fillna(0) == 1) | 
                    (X_transformed.get('symptom_vomiting', 0).fillna(0) == 1)
                )
                X_transformed['dehydration_risk_flag'] = dehyd.astype(int)
                
                # Respiratory distress
                resp_d = (
                    (rr > 24) | 
                    (o2 < 94) | 
                    (X_transformed.get('symptom_difficulty_breathing', 0).fillna(0) == 1)
                )
                X_transformed['respiratory_distress_flag'] = resp_d.astype(int)
            
            # Ensure all binary columns are properly encoded as integers
            for col in X_transformed.select_dtypes(include=['object', 'boolean']).columns:
                try:
                    is_binary_like = set(X_transformed[col].fillna(0).unique()) <= {0, 1}
                    if is_binary_like:
                        X_transformed.loc[:, col] = X_transformed[col].fillna(0).astype(int)
                except Exception:
                    pass
            
            # Fill NaNs in numeric columns with 0
            num_cols = X_transformed.select_dtypes(include=np.number).columns
            X_transformed.loc[:, num_cols] = X_transformed[num_cols].fillna(0)
            
        except Exception as e:
            logger.error(f"CFT transform logic error: {e}", exc_info=True)
            return pd.DataFrame(np.nan, index=X.index, columns=self._get_output_feature_names_fallback())
        
        if self._feature_names_out is None:
            self._feature_names_out = list(X_transformed.columns)
            
        return X_transformed

    def _get_output_feature_names_fallback(self) -> List[str]:
        if self._feature_names_out:
            return self._feature_names_out
            
        if self._raw_feature_names_in:
            try:
                mock_data = {col: [0] for col in self._raw_feature_names_in}
                mock_df = pd.DataFrame(mock_data)
                return list(self._transform_logic(mock_df).columns)
            except Exception:
                return self._raw_feature_names_in
                
        return []

    def get_feature_names_out(self, input_features=None) -> List[str]:
        if self._feature_names_out is None:
            if self.is_fitted_ and self._raw_feature_names_in:
                logger.warning("Output names not set during fit, attempting dynamic.")
                self._feature_names_out = self._get_output_feature_names_fallback()
            else:
                raise NotFittedError("Transformer not fitted/names unknown.")
                
        return self._feature_names_out if self._feature_names_out else []


class DiseaseSeverityPredictor(BaseEstimator, TransformerMixin):
    """
    Predicts disease severity based on engineered clinical features.
    """
    
    def __init__(self, n_bins: int = 3, strategy: str = 'quantile'):
        self.n_bins = n_bins
        self.strategy = strategy
        self.severity_labels = ['Low', 'Medium', 'High']
        
        if n_bins != 3:
            self.severity_labels = [f"Level_{i}" for i in range(n_bins)]
            
        self.binner_: Optional[KBinsDiscretizer] = None
        self.severity_model_: Optional[LogisticRegression] = None
        self.feature_selector_: Optional[List[str]] = None
        self._feature_names_in: Optional[List[str]] = None
        self.feature_imputer_: Optional[SimpleImputer] = None
        self.score_imputer_: Optional[SimpleImputer] = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> 'DiseaseSeverityPredictor':
        self._feature_names_in = list(X.columns)
        self.score_imputer_ = SimpleImputer(strategy='median').fit([[0]])
        
        # Create bins for discretizing severity scores
        dummy_bins_fit = [[i] for i in range(self.n_bins)]
        if len(dummy_bins_fit) < 2:
            dummy_bins_fit.append([self.n_bins])
            
        self.binner_ = KBinsDiscretizer(
            n_bins=self.n_bins,
            encode='ordinal',
            strategy='uniform'
        ).fit(dummy_bins_fit)
        
        # Select relevant clinical features for severity prediction
        potential_features = [
            'age', 'vital_oxygen_saturation', 'vital_temperature', 'vital_heart_rate',
            'vital_respiratory_rate', 'respiratory_cluster', 'neuro_cluster', 
            'systemic_cluster', 'comorbidity_count', 'sepsis_risk_flag',
            'respiratory_distress_flag', 'dehydration_risk_flag', 
            'symptom_severity_normalized', 'symptom_density', 'progression_rate',
            'rapid_deterioration', 'acute_onset', 'meningitis_pattern',
            'fever_elderly', 'fever_child', 'comorbidity_severity_interaction'
        ]
        
        self.feature_selector_ = []
        for f in potential_features:
            if f in X.columns:
                self.feature_selector_.append(f)
        
        if self.feature_selector_:
            dummy_feature_data = X[[self.feature_selector_[0]]].head(1).fillna(0).values.reshape(-1, 1)
            if dummy_feature_data.shape[0] == 0:
                dummy_feature_data = [[0]]
                
            self.feature_imputer_ = SimpleImputer(strategy='median').fit(dummy_feature_data)
        else:
            self.feature_imputer_ = None
            
        self.severity_model_ = None
        logger.debug("SeverityPredictor 'fit' called (dummy fit).")
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        # Add this safety check at the beginning of the method
        if not hasattr(self, 'score_imputer_') or self.score_imputer_ is None:
            logger.warning("Missing score_imputer_ in severity predictor - initializing")
            self.score_imputer_ = SimpleImputer(strategy='median').fit([[50]])  # Use 50 as default median
            
        check_is_fitted(self, ['_feature_names_in', 'score_imputer_'])
        X_processed = X.copy()
        
        # Ensure column alignment
        if self._feature_names_in and set(self._feature_names_in) != set(X_processed.columns):
            missing = set(self._feature_names_in) - set(X_processed.columns)
            for col in missing:
                X_processed.loc[:, col] = 0
                
            extra = set(X_processed.columns) - set(self._feature_names_in)
            X_processed = X_processed.drop(columns=list(extra), errors='ignore')
            X_processed = X_processed[self._feature_names_in]
        else:
            if not self._feature_names_in:
                logger.warning("Severity predictor input features not stored.")
                self._feature_names_in = list(X_processed.columns)
        
        # Calculate severity scores
        severity_scores = self._calculate_composite_severity(X_processed)
        severity_array = severity_scores.values.reshape(-1, 1)
        severity_array_imputed = self.score_imputer_.transform(severity_array)
        
        X_transformed = X_processed.copy()
        X_transformed['severity_score'] = severity_scores.fillna(self.score_imputer_.statistics_[0])
        
        # Determine severity category (Low, Medium, High)
        binned_scores = None
        
        # Try using trained model if available
        if (hasattr(self, 'severity_model_') and self.severity_model_ and 
                self.feature_selector_ and self.feature_imputer_):
            try:
                check_is_fitted(self.severity_model_)
                X_sev_feat = X_processed[self.feature_selector_]
                X_sev_feat_imp = self.feature_imputer_.transform(X_sev_feat)
                binned_scores = self.severity_model_.predict(X_sev_feat_imp)
                logger.debug("Severity predicted using model.")
            except (NotFittedError, Exception) as e:
                logger.error(f"Severity model predict error: {e}. Falling back.", exc_info=False)
                binned_scores = None
        
        # Fallback to simple binning if model failed
        if binned_scores is None and hasattr(self, 'binner_') and self.binner_:
            try:
                check_is_fitted(self.binner_)
                binned_scores = self.binner_.transform(severity_array_imputed).astype(int).flatten()
                logger.debug("Severity predicted using binning.")
            except (NotFittedError, Exception) as e:
                logger.error(f"Binner transform error: {e}", exc_info=False)
                binned_scores = None
        
        # Final fallback - assign Medium severity
        if binned_scores is None:
            logger.warning("Assigning default 'Medium' severity.")
            labels_array = np.full(len(X_transformed), 'Medium', dtype=object)
        else:
            binned_scores = np.clip(binned_scores, 0, len(self.severity_labels) - 1)
            labels_array = np.array(self.severity_labels)[binned_scores]
        
        X_transformed['severity'] = labels_array
        return X_transformed

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.transform(X)['severity'].values

    def _calculate_composite_severity(self, X: pd.DataFrame) -> pd.Series:
        # Start with base score of 50
        scores = pd.Series(50.0, index=X.index)
        
        # Default values for missing fields
        d_age = 30
        d_o2 = 98
        d_temp = 37.0
        d_rr = 16
        d_hr = 75
        d_count = 0
        d_rate = 0
        d_int = 0
        d_clust = 0
        d_flag = 0
        
        # Get key vital signs with fallbacks to normal values
        age = X.get('age', pd.Series(d_age, index=X.index)).fillna(d_age)
        o2_sat = X.get('vital_oxygen_saturation', pd.Series(d_o2, index=X.index)).fillna(d_o2)
        temp = X.get('vital_temperature', pd.Series(d_temp, index=X.index)).fillna(d_temp)
        resp_rate = X.get('vital_respiratory_rate', pd.Series(d_rr, index=X.index)).fillna(d_rr)
        heart_rate = X.get('vital_heart_rate', pd.Series(d_hr, index=X.index)).fillna(d_hr)
        
        # Age-based severity adjustment
        scores += age.apply(lambda a: 15 if a < 5 else (10 if a > 65 else (5 if a > 80 else 0)))
        
        # Vital sign-based adjustments
        scores += o2_sat.apply(lambda o2: 30 if o2 < 90 else (15 if o2 < 94 else 0))
        scores += temp.apply(lambda t: 15 if t > 40 else (10 if t > 39 else (5 if t > 38.5 else 0)))
        scores += resp_rate.apply(lambda rr: 20 if rr > 30 else (10 if rr > 24 else 0))
        scores += heart_rate.apply(lambda hr: 10 if hr > 120 else (5 if hr > 100 else 0))
        
        # Symptom cluster adjustments
        scores += X.get('respiratory_cluster', d_clust).fillna(d_clust) * 15
        scores += X.get('neuro_cluster', d_clust).fillna(d_clust) * 25
        scores += X.get('systemic_cluster', d_clust).fillna(d_clust) * 10
        scores += X.get('meningitis_pattern', d_flag).fillna(d_flag) * 35
        
        # Risk flags
        scores += X.get('sepsis_risk_flag', d_flag).fillna(d_flag) * 30
        scores += X.get('respiratory_distress_flag', d_flag).fillna(d_flag) * 25
        scores += X.get('dehydration_risk_flag', d_flag).fillna(d_flag) * 10
        
        # Disease burden and progression
        scores += X.get('comorbidity_count', d_count).fillna(d_count) * 6
        scores += X.get('rapid_deterioration', d_flag).fillna(d_flag) * 20
        scores += X.get('acute_onset', d_flag).fillna(d_flag) * 5
        scores += X.get('progression_rate', d_rate).fillna(d_rate).clip(-100, 100) * 0.1
        scores += X.get('comorbidity_severity_interaction', d_int).fillna(d_int).clip(0, 5000) * 0.01
        
        # Clip to valid range and handle any NaNs
        scores = scores.clip(0, 150)
        if scores.isnull().any():
            median_score = scores.median()
            logger.warning(f"NaNs in severity scores. Filling median.")
            scores = scores.fillna(median_score)
            
        return scores


class ClinicalSHAPExplainer:
    """
    Generates SHAP (SHapley Additive exPlanations) for model predictions.
    """
    
    def __init__(self, pipeline: Pipeline, feature_names: List[str]):
        self.pipeline = pipeline
        self.raw_feature_names = feature_names
        self.explainer = None
        self.explainer_type = None
        self.transformed_feature_names_: Optional[List[str]] = None
        self.base_model_type_: Optional[Type] = None
        self.is_initialized_ = False
        
        try:
            check_is_fitted(self.pipeline)
            self._initialize_explainer()
        except NotFittedError:
            logger.debug("SHAP Initializer: Pipeline not fitted at instantiation.")

    def _get_feature_names(self) -> Optional[List[str]]:
        if self.transformed_feature_names_ is not None:
            return self.transformed_feature_names_
            
        try:
            preprocessor = self.pipeline.steps[-2][1]
            check_is_fitted(preprocessor)
            
            if hasattr(preprocessor, 'get_feature_names_out'):
                feature_eng = self.pipeline.steps[-3][1]
                check_is_fitted(feature_eng)
                eng_names = feature_eng.get_feature_names_out()
                self.transformed_feature_names_ = list(preprocessor.get_feature_names_out(eng_names))
            else:
                # Fallback method using a mock input
                dummy_raw = pd.DataFrame([dict.fromkeys(self.raw_feature_names, 0)])
                feature_eng = self.pipeline.steps[-3][1]
                check_is_fitted(feature_eng)
                dummy_eng = feature_eng.transform(dummy_raw)
                n_features = preprocessor.transform(dummy_eng).shape[1]
                self.transformed_feature_names_ = [f"feature_{i}" for i in range(n_features)]
                
            return self.transformed_feature_names_
        except Exception as e:
            logger.warning(f"Could not determine transformed feature names: {e}.")
            return None

    def _initialize_explainer(self) -> None:
        if self.is_initialized_:
            return
            
        if shap is None:
            logger.warning("SHAP library not installed.")
            return
            
        try:
            check_is_fitted(self.pipeline)
            model_obj = self.pipeline.steps[-1][1]
            actual_fitted_model_for_shap = None
            
            # Handle calibrated classifiers by extracting the base estimator
            if isinstance(model_obj, CalibratedClassifierCV):
                check_is_fitted(model_obj, "calibrated_classifiers_")
                assert model_obj.calibrated_classifiers_, "Calibrator has no internal classifiers."
                
                internal_calibrator = model_obj.calibrated_classifiers_[0]
                actual_fitted_model_for_shap = getattr(
                    internal_calibrator, 'estimator', 
                    getattr(internal_calibrator, 'base_estimator', None)
                )
                
                if actual_fitted_model_for_shap is None:
                    raise AttributeError("Cannot find base estimator in internal calibrator.")
                    
                check_is_fitted(actual_fitted_model_for_shap)
                self.base_model_type_ = type(actual_fitted_model_for_shap)
            else:
                check_is_fitted(model_obj)
                actual_fitted_model_for_shap = model_obj
                self.base_model_type_ = type(actual_fitted_model_for_shap)
            
            # Get transformed feature names
            self._get_feature_names()
            
            # Determine if model is tree-based for appropriate explainer
            is_tree_model = (
                (LGBMClassifier and isinstance(actual_fitted_model_for_shap, LGBMClassifier)) or
                (XGBClassifier and XGBClassifier is not None and isinstance(actual_fitted_model_for_shap, XGBClassifier)) or
                isinstance(actual_fitted_model_for_shap, RandomForestClassifier) or
                (CatBoostClassifier and CatBoostClassifier is not None and isinstance(actual_fitted_model_for_shap, CatBoostClassifier))
            )
            
            if is_tree_model:
                logger.info(f"Using shap.TreeExplainer for {self.base_model_type_.__name__}.")
                self.explainer = shap.TreeExplainer(actual_fitted_model_for_shap)
                self.explainer_type = 'tree'
            else:
                logger.warning(f"Using shap.KernelExplainer for {self.base_model_type_.__name__}.")
                
                # Define prediction wrapper function
                def predict_proba_pipeline(X_raw):
                    return self.pipeline.predict_proba(X_raw)
                    
                self.explainer = predict_proba_pipeline
                self.explainer_type = 'kernel'
                
            self.is_initialized_ = True
            logger.info(f"SHAP Initialized (Type: {self.explainer_type})")
            
        except (NotFittedError, ValueError, AttributeError, TypeError, AssertionError) as init_err:
            logger.error(f"Error initializing SHAP: {init_err}", exc_info=False)
            self.is_initialized_ = False
        except Exception as e:
            logger.error(f"Unexpected error initializing SHAP: {e}", exc_info=True)
            self.is_initialized_ = False

    def explain(
        self, 
        X: pd.DataFrame, 
        n_features: int = 5, 
        background_data: Optional[pd.DataFrame] = None
    ) -> List[Dict[str, Any]]:
        if not self.is_initialized_:
            self._initialize_explainer()
            
        if not self.is_initialized_ or self.explainer is None or self.explainer_type is None:
            return [{"error": "SHAP explainer unavailable."}] * len(X)
        
        results = []
        
        try:
            # Apply all transformations except the final classifier
            pipeline_minus_classifier = Pipeline(self.pipeline.steps[:-1])
            X_transformed = pipeline_minus_classifier.transform(X)
            
            if hasattr(X_transformed, "toarray"):
                X_transformed = X_transformed.toarray()
            
            shap_values = None
            
            # Get SHAP values from appropriate explainer
            if self.explainer_type == 'tree':
                shap_values = self.explainer.shap_values(X_transformed)
            elif self.explainer_type == 'kernel':
                # Process background data for kernel explainer
                bg_data_proc = (
                    X_transformed if background_data is None 
                    else pipeline_minus_classifier.transform(background_data)
                )
                
                if hasattr(bg_data_proc, "toarray"):
                    bg_data_proc = bg_data_proc.toarray()
                    
                bg_summary = shap.sample(bg_data_proc, min(100, bg_data_proc.shape[0]))
                kernel_explainer_instance = shap.KernelExplainer(self.explainer, bg_summary)
                
                logger.info(f"Calculating KernelExplainer SHAP...")
                shap_values = kernel_explainer_instance.shap_values(X_transformed, nsamples='auto')
                logger.info("KernelExplainer finished.")
            
            if shap_values is None:
                raise ValueError("SHAP values calculation failed.")
            
            # Determine if multi-class or binary problem
            is_multi_class = isinstance(shap_values, list)
            
            # Get class names
            try:
                class_names = self.pipeline.named_step['classifier'].classes_
            except Exception:
                n_classes_est = len(shap_values) if is_multi_class else 2
                class_names = [f"Class_{i}" for i in range(n_classes_est)]
            
            # Get feature names
            feature_names = self._get_feature_names()
            if feature_names is None or len(feature_names) != X_transformed.shape[1]:
                logger.warning("Explain name mismatch.")
                feature_names = [f"feature_{i}" for i in range(X_transformed.shape[1])]
            
            # Create DataFrame with transformed values for reference
            if isinstance(X_transformed, np.ndarray):
                X_transformed_df = pd.DataFrame(X_transformed, columns=feature_names, index=X.index)
            else:
                try:
                    X_transformed_df = pd.DataFrame(
                        X_transformed.toarray(), columns=feature_names, index=X.index
                    )
                except AttributeError:
                    X_transformed_df = pd.DataFrame(
                        X_transformed, columns=feature_names, index=X.index
                    )
            
            # Get predicted classes
            y_pred_encoded = self.pipeline.predict(X)
            
            # Assemble explanations for each instance
            for i in range(len(X)):
                instance_idx = X.index[i]
                instance_explanation = {"key_features": {}, "predicted_class_shap": {}}
                predicted_class_index = y_pred_encoded[i]
                predicted_class_name = class_names[predicted_class_index]
                
                # Get SHAP values for this instance
                instance_shap_values = None
                if is_multi_class:
                    if predicted_class_index < len(shap_values):
                        instance_shap_values = shap_values[predicted_class_index][i]
                    else:
                        logger.error(f"SHAP index error.")
                        instance_shap_values = np.zeros(len(feature_names))
                        
                    instance_explanation["predicted_class_shap"] = {
                        "class_name": predicted_class_name,
                        "class_index": int(predicted_class_index)
                    }
                else:
                    instance_shap_values = shap_values[i]
                    instance_explanation["predicted_class_shap"] = {
                        "class_name": predicted_class_name,
                        "info": "Binary SHAP"
                    }
                
                # Process SHAP values into a feature importance dictionary
                feature_importance = {}
                if len(feature_names) == len(instance_shap_values):
                    for j, feature in enumerate(feature_names):
                        try:
                            shap_value_element = instance_shap_values[j]
                            if (hasattr(shap_value_element, '__len__') and 
                                    len(shap_value_element) == 1):
                                feature_importance[feature] = float(shap_value_element[0])
                            elif isinstance(shap_value_element, (int, float, np.number)):
                                feature_importance[feature] = float(shap_value_element)
                            else:
                                logger.warning(
                                    f"Inst {instance_idx}, Feat '{feature}': "
                                    f"Unexpected SHAP type {type(shap_value_element)}. Using 0.0."
                                )
                                feature_importance[feature] = 0.0
                        except (IndexError, TypeError) as val_err:
                            logger.warning(
                                f"Inst {instance_idx}, Feat '{feature}': "
                                f"Error processing SHAP value ({val_err}). Using 0.0."
                            )
                            feature_importance[feature] = 0.0
                else:
                    logger.warning(f"Inst {instance_idx}: Name/SHAP length mismatch.")
                
                # Get top features by absolute SHAP value
                sorted_features = sorted(
                    feature_importance.items(), 
                    key=lambda item: abs(item[1]), 
                    reverse=True
                )
                top_features = dict(sorted_features[:n_features])
                
                # Build explanation dictionary for each top feature
                key_features_dict = {}
                for feature, shap_val in top_features.items():
                    try:
                        feature_value = X_transformed_df.loc[instance_idx, feature]
                    except KeyError:
                        feature_value = "N/A"
                        
                    impact_str = round(shap_val, 4)
                    direction_str = "+" if shap_val > 0 else ("-" if shap_val < 0 else "Neutral")
                    value_str_disp = str(
                        round(feature_value, 3) if isinstance(feature_value, (int, float)) 
                        else feature_value
                    )
                    
                    key_features_dict[feature] = {
                        "value": value_str_disp,
                        "impact (SHAP)": impact_str,
                        "direction": direction_str
                    }
                
                instance_explanation["key_features"] = key_features_dict
                results.append(instance_explanation)
                
        except Exception as e:
            logger.error(f"Error generating SHAP explanations: {e}", exc_info=True)
            return [{"error": f"SHAP explanation failed: {e}"}] * len(X)
            
        return results


class ClinicalValidator:
    """
    Performs rule-based clinical validation of model predictions.
    """
    
    def __init__(self, alert_threshold: float = 0.7, inconsistency_threshold: float = 0.3):
        self.alert_threshold = alert_threshold
        self.inconsistency_threshold = inconsistency_threshold
        self.critical_diseases = {
            'Meningitis', 'Tuberculosis', 'Sepsis', 'Malaria', 'Pneumonia', 'HIV/AIDS'
        }
        self.inherently_severe = {'Meningitis', 'Sepsis'}

    def validate_prediction(self, disease: str, probability: float, severity: str) -> Dict[str, Any]:
        validation = {
            "valid": True,
            "flags": [],
            "alerts": [],
            "original_severity": severity
        }
        
        current_severity = severity
        new_severity = current_severity
        
        # Rule 1: High confidence + High severity = High Risk Alert
        if probability > self.alert_threshold and current_severity == "High":
            validation["alerts"].append({
                "type": "High Risk Alert",
                "message": f"High confidence ({probability:.1%}) for {disease} with High severity."
            })
            logger.warning(f"ALERT: High risk: {disease} ({probability:.1%}), Sev: {current_severity}")
        
        # Rule 2: Flag inconsistent low probability with high severity
        if probability < self.inconsistency_threshold and current_severity == "High":
            validation["flags"].append({
                "type": "Inconsistent Pred",
                "message": f"Low prob ({probability:.1%}) for {disease} but High severity."
            })
            logger.warning(f"FLAG: Low Prob ({probability:.1%}) / High Sev for {disease}.")
        
        # Rule 3: Adjust low severity for critical diseases with high probability 
        if probability > 0.8 and current_severity == "Low" and disease in self.critical_diseases:
            validation["flags"].append({
                "type": "Severity Underestimation?",
                "message": f"High prob ({probability:.1%}) of critical {disease} with Low severity."
            })
            new_severity = "Medium"
        
        # Apply first severity adjustment if needed
        if current_severity != new_severity:
            validation["adjusted_severity"] = new_severity
            validation["alerts"].append({
                "type": "Severity Adjusted",
                "message": f"Severity adjusted Low->{new_severity}."
            })
            logger.info(f"ADJUST: Sev Low->{new_severity} for {disease} (Prob: {probability:.1%})")
            current_severity = new_severity
        
        # Rule 4: Inherently severe diseases should always be High severity
        if probability > 0.6 and disease in self.inherently_severe and current_severity != "High":
            validation["flags"].append({
                "type": "Severity Override",
                "message": f"{disease} inherently severe. Adjusting to High."
            })
            new_severity = "High"
        
        # Apply second severity adjustment if needed
        if current_severity != new_severity:
            validation["adjusted_severity"] = new_severity
            validation["alerts"] = [a for a in validation["alerts"] if a['type'] != "Severity Adjusted"]
            validation["alerts"].append({
                "type": "Severity Adjusted",
                "message": f"Severity forced to {new_severity}."
            })
            logger.info(f"ADJUST: Sev forced to {new_severity} for {disease} (Prob: {probability:.1%})")
        
        # Rule 5: Flag extremely high probabilities for verification
        if probability > 0.98:
            validation["flags"].append({
                "type": "Overconfidence?",
                "message": f"Extremely high prob ({probability:.1%}). Verify."
            })
        
        # Default message if no issues found
        if not validation["flags"] and not validation["alerts"]:
            validation["message"] = "Prediction plausible."
            
        return validation


class ClinicalDiseasePipeline:
    """
    Main pipeline class for clinical disease prediction and explanation.
    """
    
    def __init__(
        self,
        model_type: str = 'lightgbm',
        calibrate_probabilities: bool = True,
        n_severity_levels: int = 3,
        random_state: int = RANDOM_STATE
    ):
        self.model_type = model_type
        self.calibrate_probabilities = calibrate_probabilities
        self.n_severity_levels = n_severity_levels
        self.random_state = random_state
        
        # Component placeholders
        self.feature_transformer = None
        self.preprocessor = None
        self.disease_encoder = None
        self.model = None
        self.severity_predictor = None
        self.validator = None
        self.explainer = None
        self.pipeline_ = None
        
        # State variables
        self.label_mapping_ = {}
        self.feature_names_in_ = None

    def _check_model_availability(self, model_type: str) -> None:
        """
        MODIFIED TO USE GLOBAL AVAILABILITY FLAGS
        """
        if model_type == 'lightgbm' and not LIGHTGBM_AVAILABLE:
            raise ImportError("LightGBM library needed for loading not found.")
        if model_type == 'xgboost' and not XGBOOST_AVAILABLE:
            raise ImportError("XGBoost library needed for loading not found.")
        if model_type == 'catboost' and not CATBOOST_AVAILABLE:
            raise ImportError("CatBoost library needed for loading not found.")

    def predict(self, X: pd.DataFrame, explain: bool = False, background_data_for_shap: Optional[pd.DataFrame] = None) -> List[Dict[str, Any]]:
        # More robust type checking
        from sklearn.pipeline import Pipeline
        
        # Log for debugging
        logger.info(f"Pipeline is type: {type(self.pipeline_)}")
        
        # Special handling for the case where pipeline_ is actually feature names
        if isinstance(self.pipeline_, (list, np.ndarray)) and not isinstance(self.pipeline_, Pipeline):
            error_msg = "Critical model loading error: pipeline_ contains feature names instead of Pipeline"
            logger.error(error_msg)
            raise RuntimeError(error_msg)
        
        # More specific component checks
        if self.pipeline_ is None:
            raise NotFittedError("Pipeline not loaded/fitted.")
        if not isinstance(self.pipeline_, Pipeline):
            raise TypeError(f"pipeline_ must be a Pipeline object, got {type(self.pipeline_)}")
        if self.severity_predictor is None:
            raise NotFittedError("Severity predictor not loaded/fitted.")
        if self.validator is None or not hasattr(self.validator, 'validate_prediction'):
            logger.warning("Validator missing validate_prediction method - creating emergency replacement")
            # Create a minimal validator

        # FIX: Check and repair label_mapping_ if needed
        if not isinstance(self.label_mapping_, dict) or len(self.label_mapping_) == 0:
            logger.warning("Label mapping missing or empty, creating default mapping")
            # Default disease classes
            default_diseases = [
                'Common Cold', 'Diarrheal Disease', 'HIV/AIDS', 'Malaria', 
                'Meningitis', 'Pneumonia', 'Sepsis', 'Tuberculosis', 'Typhoid Fever'
            ]
            # Make sure to use 'disease' as the loop variable, not 'name'
            self.label_mapping_ = {i: disease for i, disease in enumerate(default_diseases)}
            logger.info(f"Created default label mapping with {len(default_diseases)} diseases")
        
        # Add these fallback mechanisms after the try-except for check_is_fitted
        try:
            check_is_fitted(self.pipeline_)
            check_is_fitted(self.severity_predictor)
            check_is_fitted(self.disease_encoder, 'classes_')
        except Exception as e:
            logger.error(f"Check is fitted error: {str(e)}")
            
            # Special handling for severity predictor issues
            if "severity_predictor" in str(e) and isinstance(self.severity_predictor, (list, np.ndarray)):
                logger.warning("Recreating severity_predictor on the fly")
                # Create a minimal working replacement
                from sklearn.impute import SimpleImputer
                from sklearn.preprocessing import KBinsDiscretizer
                
                self.severity_predictor = DiseaseSeverityPredictor()
                self.severity_predictor.is_fitted_ = True
                self.severity_predictor._feature_names_in = self.feature_names_in_ if self.feature_names_in_ else list(X.columns)
                self.severity_predictor.score_imputer_ = SimpleImputer(strategy='median').fit([[50]])  # Default median
                
                # Create a basic binner
                dummy_X = np.array([[0], [1], [2]])
                self.severity_predictor.binner_ = KBinsDiscretizer(n_bins=3, encode='ordinal', strategy='uniform').fit(dummy_X)
                
                logger.info("Created emergency severity_predictor replacement")
            else:
                raise NotFittedError(f"Component not properly fitted: {str(e)}")
        
        # Rest of the predict method remains unchanged...
        pred_start_time = datetime.now()
        logger.info(f"Starting prediction for {len(X)} instances...")
        
        # Align input columns with expected features
        X_aligned = X.copy()
        if self.feature_names_in_:
            missing = set(self.feature_names_in_) - set(X_aligned.columns)
            for col in missing:
                X_aligned.loc[:, col] = 0
                
            extra = set(X_aligned.columns) - set(self.feature_names_in_)
            X_aligned = X_aligned.drop(columns=list(extra), errors='ignore')
            
            try:
                X_aligned = X_aligned[self.feature_names_in_]
            except KeyError as e:
                raise ValueError(f"Input columns cannot be aligned: {e}")
        else:
            logger.warning("Cannot guarantee column alignment - feature names not loaded.")
        
        # Apply feature engineering
        X_engineered = self.pipeline_.named_steps['feature_engineering'].transform(X_aligned)
        
        # Add severity predictions
        X_with_severity = self.severity_predictor.transform(X_engineered)
        severity_predictions = X_with_severity['severity'].values
        severity_scores = X_with_severity['severity_score'].values
        
        # Generate disease predictions
        y_pred_encoded = self.pipeline_.predict(X_aligned)
        y_pred_proba = self.pipeline_.predict_proba(X_aligned)
        y_pred_names = [self.label_mapping_.get(code, f"Unknown_{code}") for code in y_pred_encoded]
        max_probabilities = np.max(y_pred_proba, axis=1)
        
        # Generate explanations if requested
        explanations = [{} for _ in range(len(X))]
        if explain:
            if self.explainer and self.explainer.is_initialized_:
                logger.info("Generating SHAP explanations...")
                explanations = self.explainer.explain(
                    X_aligned, background_data=background_data_for_shap
                )
                logger.info(f"SHAP generated.")
            else:
                logger.warning(f"SHAP requested but explainer unavailable.")
        
        # Assemble results with validation
        results = []
        for i in range(len(X)):
            disease = y_pred_names[i]
            probability = float(max_probabilities[i])
            original_severity = severity_predictions[i]
            sev_score = float(severity_scores[i]) if pd.notna(severity_scores[i]) else None

        # Just before you use validator.validate_prediction
        if not hasattr(self.validator, 'validate_prediction'):
            logger.warning("Validator missing validate_prediction method - creating emergency replacement")
            
            class EmergencyValidator:
                def __init__(self):
                    self.critical_diseases = {'Meningitis', 'Tuberculosis', 'Sepsis', 'Malaria', 'Pneumonia', 'HIV/AIDS'}
                    self.inherently_severe = {'Meningitis', 'Sepsis'}
                    
                def validate_prediction(self, disease, probability, severity):
                    return {
                        "valid": True, 
                        "flags": [], 
                        "alerts": [],
                        "original_severity": severity,
                        "message": "Emergency validator used"
                    }
            
            self.validator = EmergencyValidator()
            logger.info("Created emergency validator replacement")
            
            # Validate prediction
            validation_result = self.validator.validate_prediction(
                disease, probability, original_severity
            )
            final_severity = validation_result.get("adjusted_severity", original_severity)
            
            results.append({
                "disease": disease,
                "probability": round(probability, 4),
                "severity": final_severity,
                "severity_score": round(sev_score, 2) if sev_score is not None else None,
                "validation": validation_result,
                "explanation": explanations[i] if i < len(explanations) else {"error": "Explain index error"}
            })
        
        pred_end_time = datetime.now()
        logger.info(
            f"Predictions generated in "
            f"{(pred_end_time - pred_start_time).total_seconds():.2f} seconds."
        )
        return results

    def predict_single(self, patient_data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        X_single = pd.DataFrame([patient_data])
        
        if self.feature_names_in_:
            aligned_data = {}
            num_missing = 0
            for col in self.feature_names_in_:
                if col not in X_single.columns:
                    aligned_data[col] = 0
                    num_missing += 1
                else:
                    aligned_data[col] = X_single.loc[0, col]
            if num_missing > 0:
                logger.debug(f"{num_missing} features missing in single input, defaulted to 0.")
            X_single_aligned = pd.DataFrame([aligned_data], index=[0])
            try:
                X_single_aligned = X_single_aligned[self.feature_names_in_]
            except KeyError as e:
                logger.error(f"Alignment error in predict_single: {e}")
                # Use what we have
                pass
        else:
            logger.warning("Original feature names unavailable for alignment.")
            X_single_aligned = X_single
            
        return self.predict(X_single_aligned, **kwargs)[0]

    # Modify this section in ClinicalDiseasePipeline class in ml_pipeline.py
    @classmethod
    def load(cls, model_dir: Union[str, Path]) -> 'ClinicalDiseasePipeline':
        model_dir = Path(model_dir)
        assert model_dir.is_dir(), f"Directory not found: {model_dir}"
        
        logger.info(f"Loading pipeline from: {model_dir}")
        
        try:
            # Load metadata and create instance
            with open(model_dir / "metadata.json", 'r') as f:
                metadata = json.load(f)
                config = metadata.get('pipeline_class_config', {})
                instance = cls(**config)
            
            # Check for required model libraries
            instance._check_model_availability(instance.model_type)
            
            # Use custom unpickler to load components
            try:
                from .model_unpickler import safe_load
                
                # Load pipeline components with custom unpickler
                instance.pipeline_ = safe_load(model_dir / "sk_pipeline.joblib")
                instance.disease_encoder = safe_load(model_dir / "disease_encoder.joblib")
                instance.severity_predictor = safe_load(model_dir / "severity_predictor.joblib")
                instance.validator = safe_load(model_dir / "validator.joblib")
                
                # Load SHAP explainer if available
                shap_path = model_dir / "shap_explainer.joblib"
                if shap_path.exists() and shap is not None:
                    try:
                        instance.explainer = safe_load(shap_path)
                    except Exception as e:
                        logger.warning(f"Could not load SHAP explainer: {e}")
                        instance.explainer = None
                else:
                    instance.explainer = None
                    
            except ImportError:
                # Fallback to regular joblib if custom unpickler fails
                logger.warning("Custom unpickler not available. Attempting standard joblib.")
                instance.pipeline_ = joblib.load(model_dir / "sk_pipeline.joblib")
                instance.disease_encoder = joblib.load(model_dir / "disease_encoder.joblib")
                instance.severity_predictor = joblib.load(model_dir / "severity_predictor.joblib")
                instance.validator = joblib.load(model_dir / "validator.joblib")
                
                # Load SHAP explainer if available
                shap_path = model_dir / "shap_explainer.joblib"
                if shap_path.exists() and shap is not None:
                    try:
                        instance.explainer = joblib.load(shap_path)
                    except Exception as e:
                        logger.warning(f"Could not load SHAP explainer: {e}")
                        instance.explainer = None
                else:
                    instance.explainer = None
            
            # Load metadata
            instance.label_mapping_ = {int(k): v for k, v in metadata.get('label_mapping', {}).items()}
            instance.feature_names_in_ = metadata.get('raw_feature_names')
            
            # Extract pipeline components for direct access
            instance.feature_transformer = instance.pipeline_.named_steps.get('feature_engineering')
            instance.preprocessor = instance.pipeline_.named_steps.get('preprocessing')
            instance.model = instance.pipeline_.named_steps.get('classifier')
            
            # Verify all essential components are loaded
            if not all([
                instance.feature_transformer,
                instance.preprocessor,
                instance.model,
                instance.disease_encoder,
                instance.severity_predictor,
                instance.validator
            ]):
                raise ValueError("Essential pipeline components failed to load/assign.")
            
            # Update SHAP explainer references if needed
            if instance.explainer:
                instance.explainer.pipeline = instance.pipeline_
                instance.explainer.raw_feature_names = instance.feature_names_in_
                instance.explainer._initialize_explainer()  # Attempt re-init
            
            logger.info("Pipeline loaded successfully.")
            return instance
            
        except FileNotFoundError as fnf:
            logger.error(f"Load error: File not found - {fnf}")
            raise
        except ImportError as imp_err:
            logger.error(f"Load error: Missing library - {imp_err}")
            raise
        except Exception as e:
            logger.error(f"Error loading pipeline: {e}", exc_info=True)
            raise
        
    def construct_fallback_pipeline(raw_feature_names, disease_class_names=None, validator=None):
        """Create a minimal pipeline that's always 'fitted'"""
        # Create steps with pre-fitted components
        steps = []
        
        # Feature engineering step (passthrough)
        from sklearn.preprocessing import FunctionTransformer
        feature_eng = FunctionTransformer(validate=False)
        feature_eng._sklearn_is_fitted_ = True
        feature_eng.feature_names_in_ = raw_feature_names
        steps.append(('feature_engineering', feature_eng))
        
        # Preprocessing step (passthrough)
        preprocessor = FunctionTransformer(validate=False)
        preprocessor._sklearn_is_fitted_ = True
        steps.append(('preprocessing', preprocessor))
        
        # Classifier step
        from sklearn.dummy import DummyClassifier
        import numpy as np
        dummy = DummyClassifier(strategy='prior')
        dummy.classes_ = np.array(range(len(disease_class_names or []) or 9))
        dummy._sklearn_is_fitted_ = True
        steps.append(('classifier', dummy))
        
        # Create a custom pipeline that's always considered fitted
        logger.info("Creating dummy pipeline that's always considered fitted")
        
        # Create a Pipeline class that doesn't check if fitted
        from sklearn.pipeline import Pipeline
        
        class DummyPipeline(Pipeline):
            """Custom Pipeline that's always considered fitted"""
            def __init__(self, steps, memory=None, verbose=False):
                super().__init__(steps, memory=memory, verbose=verbose)
                self._sklearn_is_fitted_ = True
                
            def fit(self, X, y=None, **kwargs):
                return self
                
            def predict(self, X):
                if hasattr(X, 'shape'):
                    return np.zeros(X.shape[0], dtype=int)
                return np.array([0])
                
            def predict_proba(self, X):
                n_classes = len(disease_class_names or []) or 9
                if hasattr(X, 'shape'):
                    return np.ones((X.shape[0], n_classes)) / n_classes
                return np.ones((1, n_classes)) / n_classes
        
        pipeline = DummyPipeline(steps)
        
        # Add the validator if provided
        if validator is not None:
            logger.info("Attached validator to dummy pipeline")
            pipeline.validator = validator
        
        # Ensure label_mapping_ exists
        if disease_class_names:
            pipeline.label_mapping_ = {i: name for i, name in enumerate(disease_class_names)}
        
        return pipeline