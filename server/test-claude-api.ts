// 测试 Claude API 兼容接口
const testClaudeAPI = async () => {
    const response = await fetch('http://localhost:3001/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-3-opus-20240229',
            messages: [{ role: 'user', content: '你好，请用一句话介绍你自己' }],
            max_tokens: 1024
        })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
};

testClaudeAPI().catch(console.error);
