const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');

const app = express();
const port = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());

// 配置文件上传
const upload = multer({ dest: 'uploads/' });

// 处理文件上传
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    const readFile = promisify(fs.readFile);
    const fileContent = await readFile(req.file.path, 'utf8');
    
    // 清理临时文件
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('删除临时文件失败:', err);
    });

    // 按行分割并过滤空行
    const apiKeys = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);

    res.json({ apiKeys });
  } catch (error) {
    console.error('文件处理错误:', error);
    res.status(500).json({ error: '文件处理错误' });
  }
});

// 测试单个 API Key
app.post('/api/test-single', async (req, res) => {
  try {
    const { baseUrl, apiKey, model } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: '请提供有效的 API Key' });
    }

    try {
      // 构建请求配置
      const config = {
        method: 'post',
        url: `${baseUrl}/v1/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        data: {
          model: model,
          messages: [
            {
              role: 'user',
              content: 'Hello'
            }
          ],
          max_tokens: 5
        },
        timeout: 10000 // 10秒超时
      };

      // 发送请求
      const response = await axios(config);
      
      res.json({
        apiKey,
        status: 'active',
        message: '测试成功',
        details: response.data
      });
    } catch (error) {
      let errorMessage = '未知错误';
      
      if (error.response) {
        // 服务器返回了错误状态码
        errorMessage = `错误 ${error.response.status}: ${error.response.data.error?.message || JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        // 请求已发送但没有收到响应
        errorMessage = '无响应，可能是网络问题或 API 地址错误';
      } else {
        // 请求设置时出错
        errorMessage = error.message;
      }
      
      res.json({
        apiKey,
        status: 'inactive',
        message: errorMessage
      });
    }
  } catch (error) {
    console.error('API 测试错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除了获取可用模型的接口

// 测试 API Keys
app.post('/api/test', async (req, res) => {
  try {
    const { baseUrl, apiKeys, model } = req.body;
    
    if (!apiKeys || !Array.isArray(apiKeys) || apiKeys.length === 0) {
      return res.status(400).json({ error: '请提供有效的 API Keys' });
    }

    // 并行测试所有 API Keys
    const testPromises = apiKeys.map(async (apiKey) => {
      try {
        // 构建请求配置
        const config = {
          method: 'post',
          url: `${baseUrl}/v1/chat/completions`,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          data: {
            model: model,
            messages: [
              {
                role: 'user',
                content: 'Hello'
              }
            ],
            max_tokens: 5
          },
          timeout: 10000 // 10秒超时
        };

        // 发送请求
        const response = await axios(config);
        
        return {
          apiKey,
          status: 'active',
          message: '测试成功',
          details: response.data
        };
      } catch (error) {
        let errorMessage = '未知错误';
        
        if (error.response) {
          // 服务器返回了错误状态码
          errorMessage = `错误 ${error.response.status}: ${error.response.data.error?.message || JSON.stringify(error.response.data)}`;
        } else if (error.request) {
          // 请求已发送但没有收到响应
          errorMessage = '无响应，可能是网络问题或 API 地址错误';
        } else {
          // 请求设置时出错
          errorMessage = error.message;
        }
        
        return {
          apiKey,
          status: 'inactive',
          message: errorMessage
        };
      }
    });

    const results = await Promise.all(testPromises);
    res.json(results);
  } catch (error) {
    console.error('API 测试错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 添加静态文件服务
app.use(express.static(path.join(__dirname, '../build')));

// 处理前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

app.listen(port, () => {
  console.log(`服务器运行在端口 ${port}`);
});