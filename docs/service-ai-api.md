# SSO Service AI API

SSO 서버에 등록된 사용자 API Key를 외부 서비스로 노출하지 않고 AI 요청을 대행하는 서버 전용 API입니다.

## 인증 흐름

1. 서비스가 기존 `/api/sso/exchange`에서 authorization code를 교환합니다.
2. 응답의 `access_token`을 서비스 서버 세션에 저장합니다.
3. AI API를 호출할 때 `Authorization: Bearer <access_token>` 헤더를 전송합니다.
4. SSO 서버는 토큰의 사용자 ID로 Firebase 사용자를 조회하고 API Key를 서버 내부에서만 복호화합니다.

`access_token`과 API Key를 브라우저, Zustand, 로그에 노출하면 안 됩니다.

## authorization code 교환 응답

```json
{
  "ok": true,
  "user": {
    "id": "user-id",
    "email": "user@example.com"
  },
  "access_token": "service-access-token",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

사용자 정보에는 API Key가 포함되지 않습니다.

## 모델 목록

```http
GET /api/sso/ai/models
Authorization: Bearer <access_token>
```

```json
{
  "ok": true,
  "provider": "gpt",
  "defaultModel": "gpt-5.6-sol",
  "models": [{ "id": "gpt-5.6-sol", "label": "gpt-5.6-sol" }]
}
```

## 구조화된 AI 생성

현재 구조화된 화면 생성은 `gpt` 제공자를 지원합니다.

```http
POST /api/sso/ai/generate
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "model": "gpt-5.6-sol",
  "instructions": "화면 설계 지침",
  "prompt": "사용자 요청과 현재 문서 JSON",
  "schemaName": "planning_board_document",
  "schema": {
    "type": "object",
    "additionalProperties": false
  },
  "maxOutputTokens": 16000,
  "reasoningEffort": "medium"
}
```

성공하면 SSO 서버가 제공자의 원문 구조화 결과를 `output`으로 반환합니다.

```json
{
  "ok": true,
  "provider": "gpt",
  "model": "gpt-5.6-sol",
  "output": "{...}"
}
```

서비스 프로젝트는 `output`을 JSON으로 파싱하고 서비스 도메인 규칙에 맞게 검증·정규화해야 합니다.
