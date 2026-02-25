# User OTP Signup Flow

## `POST /api/auth/register-user`
- Purpose: request signup/login OTP with phone only.
- Request body:
```json
{
  "phone": "09121234567",
  "termsAccepted": true
}
```
- Notes:
  - `phone` is required.
  - `termsAccepted` is optional, but if sent it must be `true`.
  - No `firstname`, `lastname`, `city`, or `password` is required in this step.

## `POST /api/auth/verify-user`
- Purpose: verify OTP and create user session.
- Request body:
```json
{
  "phone": "09121234567",
  "code": "12345"
}
```
- Response:
  - Returns `token`, sets `user_token` httpOnly cookie, and returns user profile data.

## Profile Completion
- After successful OTP login, optional profile fields can be saved later via:
  - `POST /api/user/profile`
  - `PUT /api/user/profile`
- Supported optional fields include: `name`, `firstname`, `lastname`, `city`, `phone`.
