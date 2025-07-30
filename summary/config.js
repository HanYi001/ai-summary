// 自动加载已保存配置
chrome.storage.local.get(["apiUrl", "apiKey"], (data) => {
    document.getElementById("apiUrl").value = data.apiUrl || "";
    document.getElementById("apiKey").value = data.apiKey || "";
});

// 保存配置
document.getElementById("btnSaveConfig").onclick = () => {
    const apiUrl = document.getElementById("apiUrl").value;
    const apiKey = document.getElementById("apiKey").value;

    chrome.storage.local.set({ apiUrl, apiKey }, () => {
        alert("配置已保存！");
        window.close(); // 关闭当前标签页或窗口
    });
};
