const SUPABASE_URL = "https://jacpijzhkfuotgifmbqs.supabase.co";
const SUPABASE_KEY = "sb_publishable_9ENUp7mPzRX_CSQarEaKLA_WG4bP44J";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const authEmail = document.getElementById("authEmail");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const authStatus = document.getElementById("authStatus");

function setStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.style.color = isError ? "red" : "";
}

async function sendLoginLink() {
  const email = authEmail.value.trim();

  if (!email) {
    setStatus("이메일 주소를 입력해줘.", true);
    return;
  }

  loginButton.disabled = true;
  setStatus("로그인 링크 보내는 중...");

  const { error } = await supabaseClient.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo:
        "https://danakim001-cmd.github.io/-toeic-study/"
    }
  });

  loginButton.disabled = false;

  if (error) {
    console.error(error);
    setStatus("오류: " + error.message, true);
    return;
  }

  setStatus("이메일로 로그인 링크를 보냈어. 메일함을 확인해줘.");
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    setStatus("로그아웃 오류: " + error.message, true);
    return;
  }

  location.reload();
}

function updateLoginScreen(user) {
  if (user) {
    authEmail.hidden = true;
    loginButton.hidden = true;
    logoutButton.hidden = false;
    setStatus(user.email + " 계정으로 로그인됨");
  } else {
    authEmail.hidden = false;
    loginButton.hidden = false;
    logoutButton.hidden = true;
    setStatus("로그인하면 여러 기기에서 수정 내용이 동기화됩니다.");
  }
}

loginButton.addEventListener("click", sendLoginLink);
logoutButton.addEventListener("click", logout);

supabaseClient.auth.getSession().then(({ data }) => {
  updateLoginScreen(data.session?.user || null);
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  updateLoginScreen(session?.user || null);
});