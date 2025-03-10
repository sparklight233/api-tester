# AI API 测活工具

一个用于测试 AI API 密钥有效性的工具，支持批量测试和结果导出。

## 功能特点

- 支持自定义 API 的 baseURL
- 从文件导入 API Key（每行一个）
- 手动输入 API Key
- 自定义测试模型
- 显示测活结果
- 提供一键复制功能
- 支持 Windows 运行和 Docker 部署

## 尝试使用

https://tester.zeaurx.com

##本地部署

### Docker Cli部署
```bash
docker run -p 15000:5000 sparklight233/api-tester:latest
```

### Docker-compose部署
```bash
services:
  api-tester:
    ports:
      - 15000:5000
    image: sparklight233/api-tester:latest
```

## 本地编译

```bash
git clone https://github.com/sparklight233/api-tester.git
docker build -t sparklight233/api-tester:latest .
docker run -p 15000:5000 sparklight233/api-tester:latest
