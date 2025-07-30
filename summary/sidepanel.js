const md = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre><code class="hljs language-${lang}">` +
                    hljs.highlight(str, {language: lang, ignoreIllegals: true}).value +
                    `</code></pre>`;
            } catch (_) {
            }
        }
        return '<pre><code class="hljs">' + md.utils.escapeHtml(str) + '</code></pre>';
    }
});

document.getElementById('btnConfig').onclick = () => {
    chrome.tabs.create({url: chrome.runtime.getURL("config.html")});
};


const chatOutput = document.getElementById("chat-output");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

// 会话上下文（可以加 prompt 历史）
let conversationHistory = [];
let conversationId = ""; // 当前对话的 ID，会持续更新


sendBtn.onclick = async () => {

    const {apiUrl, apiKey} = await chrome.storage.local.get(["apiUrl", "apiKey"]);

    const question = chatInput.value.trim();
    if (!question) return;

    renderMessage(question, 'user');
    chatInput.value = '';

    let webContent = await getCurrentWebContent();
    // 构造请求体，支持上下文
    const payload = {
        inputs: {
            content: conversationId === "" ? webContent : null
        },
        query: question,
        response_mode: "streaming",
        conversation_id: conversationId,  // 可选
        user: "abc-123"
    };

    const response = await fetch(apiUrl + "/chat-messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify(payload)
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let markdown = "";
    let messageElement = renderMessage("", "bot");

    while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop();  // 留下半截的，等下次拼接

        for (let block of blocks) {
            for (let line of block.split("\n")) {
                if (line.startsWith("data:")) {
                    const data = line.slice(5).trim();
                    if (data === "[DONE]") continue;
                    try {
                        const json = JSON.parse(data);
                        if (json.conversation_id) {
                            conversationId = json.conversation_id;
                        }
                        if (json.answer) {
                            markdown += json.answer;
                            messageElement.innerHTML = md.render(wrapThinkTagToDetails(markdown));
                            chatOutput.scrollTop = chatOutput.scrollHeight;
                        }
                    } catch (e) {
                        console.warn("解析失败", e);
                    }
                }
            }
        }
    }
};

function wrapThinkTagToDetails(markdown) {
    return markdown.replace(/<think>([\s\S]*?)<\/think>/g, (match, inner) => {
        return `<details><summary>思考过程（点击展开）</summary>\n\n${inner.trim()}\n\n</details>`;
    });
}

// 渲染聊天气泡
function renderMessage(text, type = "bot") {
    const div = document.createElement("div");
    div.className = `message ${type}`;
    div.innerText = text;
    chatOutput.appendChild(div);
    chatOutput.scrollTop = chatOutput.scrollHeight;
    return div;
}

async function getCurrentWebContent() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

    return new Promise((resolve, reject) => {
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: () => document.body.innerText,
        }, ([result]) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result.result);
            }
        });
    });
}
