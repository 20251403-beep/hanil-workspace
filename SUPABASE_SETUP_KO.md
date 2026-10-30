# Hanil Workspace — 로그인·동기화·관리자 설정

GitHub에 HTML과 SQL을 업로드했습니다. **Supabase 프로젝트는 아직 생성·연결되지 않았습니다.**

## 1. Supabase 무료 프로젝트
1. https://supabase.com/dashboard 에서 조직을 선택하고 새 프로젝트를 만듭니다. 무료 플랜을 선택합니다.
2. SQL Editor에서 `supabase/schema.sql` 내용을 전체 실행합니다.
3. Authentication → Providers에서 이메일 로그인을 사용하도록 설정합니다.
4. Authentication → URL Configuration에서 Site URL을 `https://hanil-workspace.pages.dev`로 지정하고, Redirect URLs에 `https://hanil-workspace.pages.dev/**`를 추가합니다.
5. 프로젝트의 API URL과 **publishable key**를 확인합니다.

## 2. GitHub 공개 설정
`supabase-config.js`에서 다음 **공개 값 두 개만** 수정합니다.

```js
window.HARU_SUPABASE_URL = 'https://PROJECT_ID.supabase.co';
window.HARU_SUPABASE_ANON_KEY = 'sb_publishable_YOUR_KEY';
```

`service_role`, `sb_secret_`, 데이터베이스 비밀번호는 넣지 마세요.
Commit 하면 GitHub에 연결된 Cloudflare Pages가 새 버전을 자동 배포하도록 설정되어 있어야 합니다.

## 3. 관리자 계정 지정
1. 사이트 우측 상단 로그인/동기화 → 계정 만들기 → 이메일 인증 완료.
2. Supabase SQL Editor에서 아래 SQL을 **자신의 관리자 이메일**로 바꾸어 실행합니다.

```sql
insert into public.workspace_admins(user_id)
select id from auth.users where email = 'YOUR_ADMIN_EMAIL@example.com'
on conflict (user_id) do nothing;
```

3. 사이트에서 다시 로그인하거나 동기화한 뒤 `일정 달력`의 '관리자 · 전체 사용자 공통 일정'을 확인합니다.

## 4. 점검
- 개인 일정/메모는 해당 계정에서만 수정 가능하도록 RLS를 적용했습니다.
- 공통 일정은 **로그인한 회원 전원에게만** 표시됩니다. 관리자만 등록·수정·삭제할 수 있습니다.
- 음악 및 녹음 **파일** 자체는 클라우드에 동기화되지 않습니다.
- 동시 변경은 마지막 저장이 우선할 수 있으니 중요한 개인 자료를 백업하세요.
- HTML 배포가 성공하더라도 Supabase에 프로젝트를 만들고 SQL과 연결 설정을 마쳐야 로그인/동기화가 작동합니다.
- 개인 데이터가 로그인 전 동일 브라우저에 남아 있을 수 있으므로 공용 기기 사용은 피하세요.
