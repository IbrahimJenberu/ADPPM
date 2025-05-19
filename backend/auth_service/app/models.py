"""Database models for authentication service."""

import uuid
import asyncpg
from datetime import datetime
from typing import Dict, Any, List, Optional
from .exceptions import ResourceExistsException

class UserModel:
    """User model for database operations."""

    @staticmethod
    async def create_user(
        conn,
        email: str,
        username: str,
        password_hash: str,
        full_name: str,
        department: str,
        role: str,
    ) -> Dict[str, Any]:
        """
        Create a new user in the database.

        Args:
            conn: Database connection
            email: User email
            username: Username
            password_hash: Hashed password
            full_name: User's full name
            department:: User's department
            role: User role (admin, doctor, cardroom, labroom)

        Returns:
            Created user dict
        """
        user_id = str(uuid.uuid4())
        created_at = datetime.utcnow()
        updated_at = created_at

        await conn.execute(
            """
            INSERT INTO users (
                id, 
                email, 
                username, 
                password_hash, 
                full_name, 
                department,
                role, 
                created_at,
                updated_at,
                is_active,
                is_verified
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        """,
            user_id,
            email,
            username,
            password_hash,
            full_name,
            department,
            role,
            created_at,
            updated_at,
            True,  # is_active
            False,  # is_verified
        )

        return {
            "id": user_id,
            "email": email,
            "username": username,
            "full_name": full_name,
            "department": department,
            "role": role,
            "created_at": created_at,
            "updated_at": updated_at,
            "is_active": True,
            "is_verified": False,
        }

    @staticmethod
    async def get_user_by_id(conn, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user by ID.

        Args:
            conn: Database connection
            user_id: User ID

        Returns:
            User dict or None if not found
        """
        user_record = await conn.fetchrow(
            """
            SELECT id, email, username, password_hash, role, full_name, department, 
                   created_at, updated_at, is_active, is_verified
            FROM users
            WHERE id = $1 AND is_active = true
        """,
            user_id,
        )

        if user_record:
            return dict(user_record)
        return None

    @staticmethod
    async def get_by_role(role: str, conn: asyncpg.Connection) -> List[Dict[str, Any]]:
        """Get users by role with full department info"""
        rows = await conn.fetch(
            """
            SELECT 
                id, email, username, 
                full_name, department,
                role, is_active, is_verified,
                created_at, updated_at
            FROM users
            WHERE role = $1 AND is_active = TRUE
            """,
            role,
        )
        return [dict(row) for row in rows]

    @staticmethod
    async def get_user_by_email(conn, email: str) -> Optional[Dict[str, Any]]:
        """
        Get user by email.

        Args:
            conn: Database connection
            email: User email

        Returns:
            User dict or None if not found
        """
        user_record = await conn.fetchrow(
            """
            SELECT id, email, username, password_hash, role, full_name, department,
                   created_at, updated_at, is_active, is_verified
            FROM users
            WHERE email = $1 AND is_active = true
        """,
            email,
        )

        if user_record:
            return dict(user_record)
        return None

    @staticmethod
    async def get_user_by_username(conn, username: str) -> Optional[Dict[str, Any]]:
        """
        Get user by username.

        Args:
            conn: Database connection
            username: Username

        Returns:
            User dict or None if not found
        """
        user_record = await conn.fetchrow(
            """
            SELECT id, email, username, password_hash, role, full_name, department,
                   created_at, updated_at, is_active, is_verified
            FROM users
            WHERE username = $1 AND is_active = true
        """,
            username,
        )

        if user_record:
            return dict(user_record)
        return None

    @staticmethod
    async def check_email_exists(conn, email: str) -> bool:
        """
        Check if email already exists.

        Args:
            conn: Database connection
            email: Email to check

        Returns:
            True if email exists, False otherwise
        """
        return await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND is_active = true)",
            email,
        )

    @staticmethod
    async def check_username_exists(conn, username: str) -> bool:
        """
        Check if username already exists.

        Args:
            conn: Database connection
            username: Username to check

        Returns:
            True if username exists, False otherwise
        """
        return await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1 AND is_active = true)",
            username,
        )


    @classmethod
    async def update_user(cls, conn, user_id, **fields):
        allowed_fields = {
            "email", "full_name", "department", 
            "role", "is_active", "is_verified"
        }
        update_fields = {k: v for k, v in fields.items() if k in allowed_fields}

        # Check email uniqueness if updating email
        if 'email' in update_fields:
            existing = await conn.fetchval(
                "SELECT id FROM users WHERE email = $1 AND id != $2",
                update_fields['email'],
                user_id
            )
            if existing:
                raise ResourceExistsException("Email")

        if not update_fields:
            return None

        set_clause = ", ".join(
            [f"{field} = ${i+2}" for i, field in enumerate(update_fields.keys())]
        )
        values = list(update_fields.values())

        query = f"""
            UPDATE users
            SET {set_clause}, updated_at = NOW()
            WHERE id = $1
            RETURNING *
        """

        try:
            record = await conn.fetchrow(query, user_id, *values)
            return dict(record) if record else None
        except asyncpg.exceptions.UniqueViolationError as e:
            if 'email' in str(e):
                raise ResourceExistsException("Email")
            raise

    @staticmethod
    async def update_password(conn, user_id: str, password_hash: str) -> bool:
        """
        Update user password with proper transaction handling.

        Args:
            conn: Database connection
            user_id: User ID
            password_hash: New hashed password

        Returns:
            True if successful, False otherwise
        """
        async with conn.transaction():
            # Update password and updated_at
            updated_at = datetime.utcnow()
            result = await conn.execute(
                """
                UPDATE users
                SET password_hash = $2, updated_at = $3
                WHERE id = $1 AND is_active = true
                """,
                user_id,
                password_hash,
                updated_at,
            )

            # Parse rowcount from result (format: "UPDATE 1")
            rowcount = int(result.split()[1])
            return rowcount > 0

    @staticmethod
    async def get_all_users(
        conn, skip: int = 0, limit: int = 100, role: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all users with pagination.

        Args:
            conn: Database connection
            skip: Number of records to skip
            limit: Maximum number of records to return
            role: Filter by role (optional)

        Returns:
            List of user dicts
        """
        if role:
            records = await conn.fetch(
                """
                SELECT id, email, username, role, full_name, department, 
                       created_at, updated_at, is_active, is_verified
                FROM users
                WHERE role = $3 AND is_active = true
                ORDER BY created_at DESC
                OFFSET $1 LIMIT $2
            """,
                skip,
                limit,
                role,
            )
        else:
            records = await conn.fetch(
                """
                SELECT id, email, username, role, full_name, department,
                       created_at, updated_at, is_active, is_verified
                FROM users
                WHERE is_active = true
                ORDER BY created_at DESC
                OFFSET $1 LIMIT $2
            """,
                skip,
                limit,
            )

        return [dict(record) for record in records]

    @staticmethod
    async def soft_delete_user(conn, user_id: str) -> bool:
        """
        Soft delete a user (mark as inactive).

        Args:
            conn: Database connection
            user_id: User ID

        Returns:
            True if user was deleted, False otherwise
        """
        updated_at = datetime.utcnow()
        result = await conn.execute(
            """
            UPDATE users
            SET is_active = false, updated_at = $2
            WHERE id = $1
        """,
            user_id,
            updated_at,
        )

        # Parse rowcount from result (format: "UPDATE 1")
        rowcount = int(result.split()[1])
        return rowcount > 0


class PasswordResetModel:
    """Password reset model for database operations."""

    @staticmethod
    async def create_reset_token(
        conn, user_id: str, token: str, expires_at: datetime
    ) -> str:
        """
        Create a password reset token.

        Args:
            conn: Database connection
            user_id: User ID
            token: Reset token
            expires_at: Expiration timestamp

        Returns:
            ID of the created reset token
        """
        token_id = str(uuid.uuid4())
        created_at = datetime.utcnow()

        await conn.execute(
            """
            INSERT INTO password_resets (id, user_id, token, expires_at, created_at)
            VALUES ($1, $2, $3, $4, $5)
        """,
            token_id,
            user_id,
            token,
            expires_at,
            created_at,
        )

        return token_id

    @staticmethod
    async def get_valid_reset_token(conn, token: str) -> Optional[Dict[str, Any]]:
        """
        Get a valid password reset token.

        Args:
            conn: Database connection
            token: Reset token

        Returns:
            Reset token record or None if not found or expired
        """
        token_record = await conn.fetchrow(
            """
            SELECT id, user_id, token, expires_at, created_at, used_at
            FROM password_resets
            WHERE token = $1 AND expires_at > $2 AND used_at IS NULL
        """,
            token,
            datetime.utcnow(),
        )

        if token_record:
            return dict(token_record)
        return None

    @staticmethod
    async def mark_token_used(conn, token_id: str) -> bool:
        """
        Mark a password reset token as used.

        Args:
            conn: Database connection
            token_id: Token ID

        Returns:
            True if successful, False otherwise
        """
        used_at = datetime.utcnow()
        result = await conn.execute(
            """
            UPDATE password_resets
            SET used_at = $2
            WHERE id = $1
        """,
            token_id,
            used_at,
        )

        # Parse rowcount from result (format: "UPDATE 1")
        rowcount = int(result.split()[1])
        return rowcount > 0


class RefreshTokenModel:
    """Refresh token model for database operations."""

    @staticmethod
    async def create_refresh_token(
        conn, user_id: str, token: str, expires_at: datetime
    ) -> str:
        """
        Create a refresh token.

        Args:
            conn: Database connection
            user_id: User ID
            token: Refresh token
            expires_at: Expiration timestamp

        Returns:
            ID of the created refresh token
        """
        token_id = str(uuid.uuid4())
        created_at = datetime.utcnow()

        await conn.execute(
            """
            INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
            VALUES ($1, $2, $3, $4, $5)
        """,
            token_id,
            user_id,
            token,
            expires_at,
            created_at,
        )

        return token_id

    @staticmethod
    async def get_valid_refresh_token(conn, token: str) -> Optional[Dict[str, Any]]:
        """
        Get a valid refresh token.

        Args:
            conn: Database connection
            token: Refresh token

        Returns:
            Refresh token record or None if not found, expired, or revoked
        """
        token_record = await conn.fetchrow(
            """
            SELECT id, user_id, token, expires_at, created_at, revoked_at
            FROM refresh_tokens
            WHERE token = $1 AND expires_at > $2 AND revoked_at IS NULL
        """,
            token,
            datetime.utcnow(),
        )

        if token_record:
            return dict(token_record)
        return None

    @staticmethod
    async def revoke_token(conn, token_id: str) -> bool:
        """
        Revoke a refresh token.

        Args:
            conn: Database connection
            token_id: Token ID

        Returns:
            True if successful, False otherwise
        """
        revoked_at = datetime.utcnow()
        result = await conn.execute(
            """
            UPDATE refresh_tokens
            SET revoked_at = $2
            WHERE id = $1
        """,
            token_id,
            revoked_at,
        )

        # Parse rowcount from result (format: "UPDATE 1")
        rowcount = int(result.split()[1])
        return rowcount > 0

    @staticmethod
    async def revoke_all_user_tokens(conn, user_id: str) -> int:
        """
        Revoke all refresh tokens for a user.

        Args:
            conn: Database connection
            user_id: User ID

        Returns:
            Number of tokens revoked
        """
        revoked_at = datetime.utcnow()
        result = await conn.execute(
            """
            UPDATE refresh_tokens
            SET revoked_at = $2
            WHERE user_id = $1 AND revoked_at IS NULL
        """,
            user_id,
            revoked_at,
        )

        # Parse rowcount from result (format: "UPDATE x")
        rowcount = int(result.split()[1])
        return rowcount

