Supabase에서 계좌 API 키를 받아 휴대폰에서 직접 조회하는 기능을 추가했습니다. 설정의 키 입력칸을 ‘Supabase에서 키 가져오기’로 바꿨습니다. 로그인한 소유자와 등록 기기를 모두 확인하고 키를 Android Keystore로 암호화합니다. 기존 저장 키와 자산, 하루 한 번 조회 기록 및 위젯 동작은 유지합니다.

사용자는 Supabase → asset-hub → Edge Functions → Secrets에 키움은 KIWOOM_APP_KEY와 KIWOOM_APP_SECRET, 업비트는 UPBIT_ACCESS_KEY와 UPBIT_SECRET_KEY를 등록하세요. 앱 업데이트 → Wi-Fi 등록 및 기관 허용 IP 설정 → 서버 키 등록 상태 확인 → 키 가져오기 순서입니다. Publishable key는 바꾸지 않습니다. 서버의 본인 사용자 권한 설정은 완료했습니다. 키 교체 후에는 다시 가져오기를 누르세요.

호환되는 기능 추가로 1.13.0 / versionCode 23입니다. 기존 앱을 삭제하지 않고 APK를 열어 업데이트하세요. 개인 기관 키가 아직 없어 실제 잔고 조회·절전 중 실행은 휴대폰에서 확인해야 합니다. Supabase가 기관 대신 조회하는 방식이 아니므로 허용 IP 조건은 유지됩니다.

GitHub 파일명 제약으로 직접 APK는 asset-hub-1.13.0.apk이며 ZIP 안에 통합 자산관리 - 1.13.0.apk를 보존합니다.
