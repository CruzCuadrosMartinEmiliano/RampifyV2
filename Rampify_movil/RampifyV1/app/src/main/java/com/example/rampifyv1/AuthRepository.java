package com.example.rampifyv1;

import android.content.Context;
import android.content.SharedPreferences;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.UUID;

/**
 * Persistencia local temporal de autenticación.
 * La clase concentra el contrato que posteriormente se reemplazará por la API.
 */
public class AuthRepository {

    private static final String PREFS = "auth_local";
    private static final String KEY_EMAIL = "email";
    private static final String KEY_NAME = "name";
    private static final String KEY_PASSWORD = "password_hash";
    private static final String KEY_FAILED_ATTEMPTS = "failed_attempts";
    private static final String KEY_LOCKED_UNTIL = "locked_until";
    private static final String KEY_SESSION = "session";
    private static final String KEY_RECOVERY_CODE = "recovery_code";
    private static final String KEY_RECOVERY_EXPIRES = "recovery_expires";
    private static final String KEY_DELETE_REQUESTED_AT = "delete_requested_at";

    private final SharedPreferences preferences;

    public AuthRepository(Context context) {
        preferences = context.getApplicationContext()
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public boolean hasAccount() {
        return preferences.contains(KEY_EMAIL);
    }

    public String getEmail() {
        return preferences.getString(KEY_EMAIL, "");
    }

    public String getName() {
        return preferences.getString(KEY_NAME, "Usuario");
    }

    public boolean hasAccountDeletionRequest() {
        return preferences.contains(KEY_DELETE_REQUESTED_AT);
    }

    public void cancelAccountDeletion() {
        preferences.edit().remove(KEY_DELETE_REQUESTED_AT).apply();
    }

    public boolean updateEmail(String newEmail) {
        if (!hasAccount()) {
            return false;
        }
        preferences.edit().putString(KEY_EMAIL, normalizeEmail(newEmail)).apply();
        return true;
    }

    public boolean updatePassword(String currentPassword, String newPassword) {
        if (!hasAccount() || !hash(currentPassword)
                .equals(preferences.getString(KEY_PASSWORD, ""))) {
            return false;
        }
        preferences.edit().putString(KEY_PASSWORD, hash(newPassword)).apply();
        return true;
    }

    public void requestAccountDeletion() {
        preferences.edit().putLong(KEY_DELETE_REQUESTED_AT, System.currentTimeMillis()).apply();
    }

    public boolean register(String name, String email, String password) {
        if (hasAccount() || name == null || email == null || password == null) {
            return false;
        }
        preferences.edit()
                .putString(KEY_NAME, name.trim())
                .putString(KEY_EMAIL, normalizeEmail(email))
                .putString(KEY_PASSWORD, hash(password))
                .putInt(KEY_FAILED_ATTEMPTS, 0)
                .remove(KEY_LOCKED_UNTIL)
                .apply();
        return true;
    }

    public LoginResult login(String email, String password) {
        long now = System.currentTimeMillis();
        long lockedUntil = preferences.getLong(KEY_LOCKED_UNTIL, 0L);
        if (lockedUntil > now) {
            return LoginResult.locked(lockedUntil - now);
        }
        if (!hasAccount()
                || !normalizeEmail(email).equals(preferences.getString(KEY_EMAIL, ""))
                || !hash(password).equals(preferences.getString(KEY_PASSWORD, ""))) {
            int failedAttempts = preferences.getInt(KEY_FAILED_ATTEMPTS, 0) + 1;
            SharedPreferences.Editor editor = preferences.edit()
                    .putInt(KEY_FAILED_ATTEMPTS, failedAttempts);
            if (failedAttempts >= 5) {
                editor.putLong(KEY_LOCKED_UNTIL, now + 15 * 60 * 1000L)
                        .putInt(KEY_FAILED_ATTEMPTS, 0);
            }
            editor.apply();
            return failedAttempts >= 5
                    ? LoginResult.locked(15 * 60 * 1000L)
                    : LoginResult.invalid();
        }
        preferences.edit()
                .putBoolean(KEY_SESSION, true)
                .putInt(KEY_FAILED_ATTEMPTS, 0)
                .remove(KEY_LOCKED_UNTIL)
                .apply();
        return LoginResult.success();
    }

    public String beginPasswordRecovery(String email) {
        if (!hasAccount() || !normalizeEmail(email).equals(preferences.getString(KEY_EMAIL, ""))) {
            return null;
        }
        String code = String.format(Locale.US, "%06d",
                Math.abs(UUID.randomUUID().hashCode()) % 1_000_000);
        preferences.edit()
                .putString(KEY_RECOVERY_CODE, code)
                .putLong(KEY_RECOVERY_EXPIRES, System.currentTimeMillis() + 10 * 60 * 1000L)
                .apply();
        return code;
    }

    public RecoveryResult resetPassword(String code, String newPassword) {
        String savedCode = preferences.getString(KEY_RECOVERY_CODE, "");
        long expiresAt = preferences.getLong(KEY_RECOVERY_EXPIRES, 0L);
        if (savedCode.isEmpty() || !savedCode.equals(code) || expiresAt < System.currentTimeMillis()) {
            return RecoveryResult.INVALID_CODE;
        }
        preferences.edit()
                .putString(KEY_PASSWORD, hash(newPassword))
                .remove(KEY_RECOVERY_CODE)
                .remove(KEY_RECOVERY_EXPIRES)
                .apply();
        return RecoveryResult.SUCCESS;
    }

    public void logout() {
        preferences.edit().putBoolean(KEY_SESSION, false).apply();
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.US);
    }

    private static String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) {
                result.append(String.format(Locale.US, "%02x", item));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 no está disponible", exception);
        }
    }

    public enum RecoveryResult {
        SUCCESS,
        INVALID_CODE
    }

    public static final class LoginResult {
        public final boolean success;
        public final long lockRemainingMillis;

        private LoginResult(boolean success, long lockRemainingMillis) {
            this.success = success;
            this.lockRemainingMillis = lockRemainingMillis;
        }

        static LoginResult success() {
            return new LoginResult(true, 0L);
        }

        static LoginResult invalid() {
            return new LoginResult(false, 0L);
        }

        static LoginResult locked(long remainingMillis) {
            return new LoginResult(false, remainingMillis);
        }
    }
}
