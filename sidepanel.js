// APIキーは chrome.storage.local から取得します
let detectedPrices = [];

window.addEventListener('load', () => {
  const btn = document.getElementById('analyze-btn');
  const status = document.getElementById('status');
  const result = document.getElementById('ai-result');
  const iframe = document.getElementById('mercari-frame');
  const optionsLink = document.getElementById('open-options');

  if (optionsLink) {
    optionsLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });
  }

  const loadUrl = () => {
    chrome.storage.local.get("targetUrl", (data) => {
      if (data.targetUrl) {
        detectedPrices = [];
        result.style.display = "none";
        status.style.color = "#666";
        status.textContent = "メルカリ読み込み完了。下の画面を少しスクロールしてください。";
        iframe.src = data.targetUrl;
      }
    });
  };
  loadUrl();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "PRICES_FOUND") {
      detectedPrices = message.prices;
      status.style.color = "#ff002b";
      status.style.fontWeight = "bold";
      status.textContent = `✅ ${detectedPrices.length}件の価格を検知！AI分析可能です。`;
    }
  });

  btn.addEventListener('click', async () => {
    if (detectedPrices.length === 0) return;

    btn.disabled = true;
    status.textContent = "分析中...";
    result.style.display = "none";

    try {
      // APIキーをストレージから取得し、念のため前後の空白や改行を削除する
      const storageData = await chrome.storage.local.get(['geminiApiKey']);
      const apiKey = storageData.geminiApiKey ? storageData.geminiApiKey.trim() : null;

      if (!apiKey) {
        status.textContent = "エラー: APIキーが設定されていません。オプション画面から設定してください。";
        status.style.color = "#ff002b";
        btn.disabled = false;
        return;
      }

      // ご提示いただいた利用可能リストの中で、最も高速で低コストな標準モデルを指定します
      const MODEL = "gemini-2.5-flash"; 
      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

      const formattedPrices = detectedPrices.map(p => `${p}円`).join('、');
      const prompt = `あなたは市場データ分析官です。以下の価格統計データのみを客観的に分析し、1.平均相場 2.推奨価格 3.売却のコツを300字以内で教えてください。個人情報は含まれません。 データ: ${formattedPrices}`;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Gemini API Error:", data);
        let errorMsg = data.error?.message || '通信に失敗しました';
        
        // 原因究明のため、このAPIキーで使えるモデルの一覧を取得して表示する
        try {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const listData = await listRes.json();
            if (listData.models) {
                const availableModels = listData.models
                    .map(m => m.name.replace('models/', ''))
                    .filter(name => name.includes('gemini'))
                    .join(', ');
                errorMsg += `\n\n【このAPIキーで利用可能なモデル】\n${availableModels || '(利用可能モデルなし)'}`;
            }
        } catch (err) {
            console.error(err);
        }

        status.textContent = `APIエラー:\n${errorMsg}`;
        status.style.color = "#ff002b";
        status.style.whiteSpace = "pre-wrap"; // 改行を表示するため
        btn.disabled = false;
        return; // エラー時はここで終了し、簡易計算を出さない
      }

      // --- ここが重要：AIが正常に応答した場合 ---
      if (data.candidates && data.candidates[0].content) {
        result.textContent = data.candidates[0].content.parts[0].text;
        status.style.color = "#00aa00";
        status.textContent = "AIによる詳細分析が完了しました。";
      } else {
        // --- AIが「詳細分析を制限」した場合のフォールバック ---
        runSimpleAnalysis();
      }

    } catch (e) {
      console.error(e);
      status.textContent = `通信エラー: ${e.message}`;
      status.style.color = "#ff002b";
      runSimpleAnalysis(); // ネットワークエラー等のみ計算を出す
    } finally {
      btn.disabled = false;
      result.style.display = "block";
    }
  });

  // JavaScript側で即座に計算する関数
  function runSimpleAnalysis() {
    const sum = detectedPrices.reduce((a, b) => a + b, 0);
    const avg = Math.floor(sum / detectedPrices.length);
    const min = Math.min(...detectedPrices);
    const max = Math.max(...detectedPrices);

    // メルカリ手数料10%と送料目安（ゆうパケットポストmini 180円）を引いた利益
    const profit = Math.floor(avg * 0.9 - 180);

    result.innerHTML = `
      <div style="background: #fff8e1; border: 1px solid #ffc107; padding: 12px; border-radius: 8px;">
        <p style="margin: 0 0 8px; color: #856404; font-weight: bold;">⚠️ AI制限中のため簡易計算を表示</p>
        <div style="font-size: 0.95em; color: #333;">
          <div><b>平均価格:</b> ${avg.toLocaleString()}円</div>
          <div><b>価格帯:</b> ${min.toLocaleString()}円 ～ ${max.toLocaleString()}円</div>
          <div style="margin-top: 8px; border-top: 1px solid #ffcc00; padding-top: 8px;">
            <b>手取り目安:</b> <span style="color: #ff002b; font-size: 1.1em; font-weight: bold;">約${profit.toLocaleString()}円</span>
          </div>
          <div style="font-size: 0.8em; color: #666; margin-top: 4px;">（手数料10%・送料180円を差し引き）</div>
        </div>
      </div>
    `;
    status.style.color = "#856404";
    status.textContent = "AIが詳細分析を制限したため、統計計算を表示しました。";
  }

  chrome.storage.onChanged.addListener((changes) => { if (changes.targetUrl) loadUrl(); });
});