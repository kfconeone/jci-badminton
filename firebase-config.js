/**
 * Firebase 設定檔
 *
 * 使用說明：
 * 1. 前往 Firebase Console (https://console.firebase.google.com/)
 * 2. 建立或選擇專案
 * 3. 在專案設定中取得 Web 應用程式的設定
 * 4. 將下方的 YOUR_XXX 替換為實際值
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 檢查是否已設定
function isFirebaseConfigured() {
  return !firebaseConfig.apiKey.startsWith('YOUR_');
}
