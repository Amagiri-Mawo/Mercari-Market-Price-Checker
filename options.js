document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const saveBtn = document.getElementById('save-btn');
    const statusMsg = document.getElementById('status-msg');
    const toggleVisibilityBtn = document.getElementById('toggle-visibility');

    // 保存済みのAPIキーを読み込む
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
    });

    // パスワードの表示・非表示切り替え
    toggleVisibilityBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleVisibilityBtn.textContent = '隠す';
        } else {
            apiKeyInput.type = 'password';
            toggleVisibilityBtn.textContent = '表示';
        }
    });

    // 保存ボタンのクリックイベント
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('APIキーを入力してください。', 'error');
            return;
        }

        chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
            showStatus('APIキーを保存しました！', 'success');
        });
    });

    // ステータスメッセージを表示する関数
    function showStatus(message, type) {
        statusMsg.textContent = message;
        statusMsg.className = type;
        
        // 3秒後にメッセージを消す
        setTimeout(() => {
            statusMsg.className = '';
        }, 3000);
    }
});
