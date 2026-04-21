export type TermsSection = {
  title: string;
  body: string;
};

export type TermsDocument = {
  version: string;
  effectiveDate: string;
  title: string;
  notice: string[];
  sections: TermsSection[];
};

export const DEFAULT_TERMS_DOCUMENT: TermsDocument = {
  version: "2026-04-21",
  effectiveDate: "2026-04-21",
  title: "hams-oauth 서비스 이용약관",
  notice: [
    "서비스 약관은 회원가입 시점에 동의한 버전이 적용됩니다.",
    "약관 내용은 사전 공지 없이 변경될 수 있으므로, 정기적으로 확인해 주시기 바랍니다.",
  ],
  sections: [
    {
      title: "제1조 목적",
      body:
        "이 약관은 hams-oauth가 제공하는 회원가입, 로그인, OAuth 연동 및 관련 인증 서비스의 이용조건, 회원의 권리와 의무, 서비스 운영 기준을 정하는 것을 목적으로 합니다.",
    },
    {
      title: "제2조 계정 생성과 이용자 정보",
      body:
        "회원은 정확하고 최신의 정보를 입력해야 하며, 로그인 ID, 이메일 주소, 닉네임, 전화번호 등 계정 운영에 필요한 정보에 변동이 생기면 지체 없이 수정해야 합니다. 타인의 정보 또는 권리를 침해하는 정보로 계정을 생성해서는 안 됩니다.",
    },
    {
      title: "제3조 전화번호 및 본인 확인",
      body:
        "회원이 입력한 전화번호는 계정 식별, 공지 전달, 운영상 필요한 연락 및 본인 확인 보조 수단으로 활용될 수 있습니다. 회원은 본인이 적법하게 사용할 수 있는 전화번호만 등록해야 합니다.",
    },
    {
      title: "제4조 허용되지 않는 이용",
      body:
        "회원은 관련 법령과 본 약관을 준수해야 하며, 서비스의 정상적인 운영을 방해하거나, 무단 접근을 시도하거나, 자동화된 수단으로 과도한 요청을 발생시키거나, 타인의 계정을 도용하는 행위를 해서는 안 됩니다.",
    },
    {
      title: "제5조 회원 콘텐츠와 책임",
      body:
        "회원이 서비스 이용 과정에서 제출하거나 생성한 정보에 대한 책임은 해당 회원에게 있습니다. 회원은 자신이 제출한 정보가 법령, 제3자의 권리 및 본 약관을 위반하지 않음을 보장해야 합니다.",
    },
    {
      title: "제6조 서비스 변경 및 중단",
      body:
        "hams-oauth는 서비스의 전부 또는 일부를 개선, 변경 또는 종료할 수 있으며, 중대한 변경이 있는 경우 서비스 화면 또는 등록된 연락수단을 통해 합리적인 방법으로 안내합니다.",
    },
    {
      title: "제7조 계정 제한 및 해지",
      body:
        "회원이 본 약관 또는 관련 법령을 위반하는 경우 hams-oauth는 사전 통지 후 또는 긴급한 경우 사후 통지와 함께 계정 사용 제한, 일부 기능 제한 또는 계정 해지를 할 수 있습니다.",
    },
    {
      title: "제8조 책임의 제한",
      body:
        "hams-oauth는 천재지변, 통신장애, 제3자 서비스 장애 등 합리적으로 통제하기 어려운 사유로 발생한 손해에 대하여 책임을 부담하지 않습니다. 다만 관련 법령상 제한이 허용되지 않는 경우에는 그 범위 내에서 책임을 집니다.",
    },
    {
      title: "제9조 약관의 개정",
      body:
        "hams-oauth는 서비스 운영상 필요하거나 법령 변경이 있는 경우 약관을 개정할 수 있습니다. 중요한 변경은 시행 전에 공지하며, 시행 후 서비스를 계속 이용하는 경우 개정 약관에 동의한 것으로 봅니다.",
    },
    {
      title: "제10조 문의",
      body:
        "본 약관과 서비스 이용에 관한 문의는 hams-oauth 운영 채널 또는 별도로 안내되는 연락수단을 통해 접수할 수 있습니다.",
    },
  ],
};

export const HAMS_OAUTH_CURRENT_TERMS_VERSION = DEFAULT_TERMS_DOCUMENT.version;
export const HAMS_OAUTH_TERMS = DEFAULT_TERMS_DOCUMENT;
export const HAMS_OAUTH_TERMS_HISTORY = [DEFAULT_TERMS_DOCUMENT];

export function getTermsDocument(version: string) {
  return version === DEFAULT_TERMS_DOCUMENT.version ? DEFAULT_TERMS_DOCUMENT : null;
}
