// 测试本地 Qwen 接口
const testQwen = async () => {
    const response = await fetch('http://localhost:3001/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-3-opus',
            messages: [{ role: 'user', content: '你好，请用一句话介绍你自己' }],
            max_tokens: 100
        })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
};

testQwen().catch(console.error);
