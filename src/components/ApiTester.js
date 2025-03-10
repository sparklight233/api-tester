import React, { useState } from 'react';
import { Form, Input, Button, Upload, Table, message, Space, Progress, Radio } from 'antd';
import { UploadOutlined, CopyOutlined } from '@ant-design/icons';
import { testApiKeys } from '../services/apiService';

const { TextArea } = Input;

const ApiTester = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [progress, setProgress] = useState(0); 
  const [apiType, setApiType] = useState('openai'); 
  const [testInterval, setTestInterval] = useState(500);
  const [isTesting, setIsTesting] = useState(false);
  const [lastTestIndex, setLastTestIndex] = useState(0);
  
  // 使用对象存储API默认配置，简化代码
  const API_DEFAULTS = {
    openai: { baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini' },
    claude: { baseUrl: 'https://api.anthropic.com', model: 'claude-3.5-sonnet' },
    gemini: { baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.0-flash' },
    custom: { baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' }
  };
  
  // 简化获取默认值的函数
  const getDefaultBaseUrl = (type) => API_DEFAULTS[type]?.baseUrl || API_DEFAULTS.openai.baseUrl;
  const getDefaultModel = (type) => API_DEFAULTS[type]?.model || API_DEFAULTS.openai.model;
  
  // 处理响应信息，去掉特定词语
  const processResponseMessage = (message) => {
    if (!message) return message;
    return message
      .replace(/openai|gemini|claude|anthropic|gpt/gi, '')
      .replace(/:/g, '')
      .trim();
  };
  
  const handleTestApi = async (values) => {
    setLoading(true);
    setIsTesting(true);
    setResults([]);
    setProgress(0);
    
    try {
      let apiKeys = [];
      
      // 从文本输入或文件获取 API Keys
      if (values.apiKeys && fileList.length === 0) {
        apiKeys = values.apiKeys
          .split('\n')
          .map(key => key.trim())
          .filter(key => key);
      } else if (fileList.length > 0) {
        const formData = new FormData();
        formData.append('file', fileList[0].originFileObj);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        apiKeys = data.apiKeys;
      }
      
      if (apiKeys.length === 0) {
        message.error('请输入至少一个 API Key');
        setLoading(false);
        setIsTesting(false);
        return;
      }
      
      // 去重处理
      const uniqueApiKeys = [...new Set(apiKeys)];
      if (uniqueApiKeys.length < apiKeys.length) {
        message.info(`已自动去除 ${apiKeys.length - uniqueApiKeys.length} 个重复的 API Key`);
        apiKeys = uniqueApiKeys;
      }
      
      // 在测试 API 的函数中，处理响应信息
      const onProgress = (result, index) => {
        const processedResult = {
          ...result,
          message: processResponseMessage(result.message),
          fullMessage: processResponseMessage(result.fullMessage)
        };
        
        setResults(prev => {
          // 按状态排序：存活的在前，失效的在后
          const newResults = [...prev, processedResult].sort((a, b) => 
            a.status === b.status ? 0 : (a.status === 'active' ? -1 : 1)
          );
          return newResults;
        });
        
        // 更新进度
        setProgress(Math.floor(((index + 1) / apiKeys.length) * 100));
      };
      
      // 从上次停止的位置继续测试
      await testApiKeys({
        baseUrl: values.baseUrl || getDefaultBaseUrl(apiType),
        apiKeys,
        model: values.model || getDefaultModel(apiType),
        apiType,
        onProgress,
        interval: parseInt(values.interval) || testInterval,
        startIndex: lastTestIndex
      });
      
      // 测试完成，重置索引
      setLastTestIndex(0);
      message.success(`测试完成，共测试 ${apiKeys.length} 个 API Key`);
      
    } catch (error) {
      console.error('测试 API 时出错:', error);
      message.error('测试 API 时出错: ' + error.message);
    } finally {
      setLoading(false);
      setIsTesting(false);
    }
  };
  
  // 重置测试
  const handleResetTest = () => {
    setResults([]);
    setLastTestIndex(0);
    setProgress(0);
  };
  
  // 当API类型改变时更新表单默认值
  const handleApiTypeChange = (value) => {
    setApiType(value);
    form.setFieldsValue({
      baseUrl: getDefaultBaseUrl(value),
      model: getDefaultModel(value)
    });
  };
  
  // 修改handleUploadChange函数，确保正确格式
  const handleUploadChange = ({ fileList }) => {
    setFileList(fileList.length > 1 ? [fileList[fileList.length - 1]] : fileList);
  };
  
  // 简化复制到剪贴板函数
  const copyToClipboard = (text) => navigator.clipboard.writeText(text);
  
  // 复制所有有效的API Keys
  const copyActiveKeys = () => {
    const activeKeys = results
      .filter(item => item.status === 'active')
      .map(item => item.apiKey)
      .join('\n');
    
    if (activeKeys) copyToClipboard(activeKeys);
  };

  // 表格列定义
  const columns = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <span style={{ color: status === 'active' ? '#52c41a' : '#f5222d', fontWeight: 'bold' }}>
          {status === 'active' ? '有效' : '失效'}
        </span>
      ),
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      ellipsis: true,
    },
    {
      title: '响应信息',
      dataIndex: 'message',
      key: 'message',
      render: (text, record) => (
        <span title={record.fullMessage || text}>
          {text}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="primary" 
          size="small"
          onClick={() => copyToClipboard(record.apiKey)}
          icon={<CopyOutlined />}
        >
          复制
        </Button>
      ),
    },
  ];
  
  const uploadProps = {
    beforeUpload: () => false,
    fileList,
    onChange: handleUploadChange,
    maxCount: 1,
  };

  return (
    <div style={{ padding: '0' }}>
      <div style={{ padding: '20px', display: 'flex', gap: '20px' }}>
        {/* 左侧配置区域 */}
        <div style={{ 
          backgroundColor: '#f5f8ff', 
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #e8e8e8',
          width: '50%',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleTestApi}
            initialValues={{
              baseUrl: getDefaultBaseUrl(apiType),
              model: getDefaultModel(apiType),
              interval: testInterval,
            }}
            requiredMark={false}
            style={{ padding: '20px' }}
          >
            <Form.Item
              label="API 类型"
              name="apiType"
              initialValue={apiType}
            >
              <Radio.Group onChange={(e) => handleApiTypeChange(e.target.value)} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Radio.Button value="openai" style={{ flex: 'none' }}>OpenAI</Radio.Button>
                <Radio.Button value="claude" style={{ flex: 'none' }}>Claude</Radio.Button>
                <Radio.Button value="gemini" style={{ flex: 'none' }}>Gemini</Radio.Button>
                <Radio.Button value="custom" style={{ flex: 'none' }}>自定义</Radio.Button>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              label="API Base URL"
              name="baseUrl"
              rules={[{ required: true, message: '请输入 API Base URL' }]}
            >
              <Input placeholder={`例如: ${getDefaultBaseUrl(apiType)}`} />
            </Form.Item>
            
            <Form.Item
              label="测试模型"
              name="model"
              rules={[{ required: true, message: '请输入测试模型' }]}
            >
              <Input placeholder={`默认: ${getDefaultModel(apiType)}`} />
            </Form.Item>
            
            <Form.Item
              label="测试间隔 (毫秒)"
              name="interval"
              rules={[{ required: true, message: '请输入测试间隔' }]}
            >
              <Input type="number" min={0} placeholder="默认: 500ms" />
            </Form.Item>
            
            <Form.Item
              label="API Keys (每行一个)"
              name="apiKeys"
            >
              <TextArea
                placeholder="在此输入 API Keys，每行一个"
                autoSize={{ minRows: 4, maxRows: 10 }}
                disabled={fileList.length > 0}
              />
            </Form.Item>
            
            <Form.Item label="或从文件导入 API Keys">
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
              {fileList.length > 0 && (
                <div style={{ marginTop: '8px', color: '#faad14' }}>
                  注意: 上传文件后，手动输入的 API Keys 将被忽略
                </div>
              )}
            </Form.Item>
            
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  disabled={isTesting}
                >
                  {lastTestIndex > 0 ? '继续测试' : '开始测试'}
                </Button>
                
                {lastTestIndex > 0 && !isTesting && (
                  <Button onClick={handleResetTest}>
                    重置测试
                  </Button>
                )}
              </Space>
            </Form.Item>
          </Form>
        </div>
        
        {/* 右侧结果区域 */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 右侧顶部信息卡片 */}
          <div style={{ 
            backgroundColor: '#f0f7ff', 
            padding: '15px 20px', 
            borderRadius: '8px',
            border: '1px solid #d6e4ff',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ color: '#1668dc' }}>
              填写 API Keys 并点击"开始测试"按钮开始测试，测试结果将显示在右侧。
            </div>
          </div>
          
          {/* 进度条区域 */}
          {isTesting && (
            <div style={{ 
              backgroundColor: '#f5f8ff', 
              padding: '15px 20px', 
              borderRadius: '8px',
              border: '1px solid #e8e8e8',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>测试进度: {progress}%</div>
              <Progress percent={progress} status="active" />
            </div>
          )}
          
          {/* 测试结果区域 */}
          {results.length > 0 ? (
            <div style={{ 
              backgroundColor: '#f5f8ff', 
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #e8e8e8',
              flex: '1',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ 
                backgroundColor: '#f5f8ff', 
                padding: '12px 20px',
                borderBottom: '1px solid #e8e8e8',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center'
              }}>
                <Button
                  type="primary"
                  onClick={copyActiveKeys}
                  icon={<CopyOutlined />}
                >
                  复制所有有效的 API Keys
                </Button>
              </div>
              
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <Space size="large">
                    <span style={{ fontSize: '16px' }}>
                      有效: <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                        {results.filter(r => r.status === 'active').length}
                      </span>
                    </span>
                    <span style={{ fontSize: '16px' }}>
                      失效: <span style={{ color: '#f5222d', fontWeight: 'bold' }}>
                        {results.filter(r => r.status !== 'active').length}
                      </span>
                    </span>
                    <span style={{ fontSize: '16px' }}>
                      总计: <span style={{ fontWeight: 'bold' }}>
                        {results.length}
                      </span>
                    </span>
                  </Space>
                </div>
                
                <Table 
                  columns={columns} 
                  dataSource={results.map((item, index) => ({ ...item, key: index }))} 
                  pagination={{ pageSize: 10 }}
                  bordered
                  size="small"
                />
              </div>
            </div>
          ) : (
            /* 当没有测试结果时显示的提示卡片 */
            <div style={{ 
              backgroundColor: '#f5f8ff', 
              padding: '30px 20px', 
              borderRadius: '8px',
              border: '1px solid #e8e8e8',
              flex: '1',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ fontSize: '18px', color: '#1890ff', marginBottom: '15px' }}>
                暂无测试结果
              </div>
              <div style={{ color: '#666', textAlign: 'center' }}>
                请在左侧填写 API Keys 并点击"开始测试"按钮开始测试
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiTester;