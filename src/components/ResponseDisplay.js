import React from 'react';
import './ResponseDisplay.css';

function ResponseDisplay({ response }) {
  if (!response) return null;

  // 提取简化的响应内容
  const getSimplifiedResponse = () => {
    if (response.error) {
      return `错误: ${response.error}`;
    }
    
    // 根据不同API类型返回简化的响应
    return '请求成功 (悬停查看详细信息)';
  };

  return (
    <div className="response-container">
      <h3>响应结果</h3>
      <div 
        className="response-content" 
        title={JSON.stringify(response, null, 2)}
        data-tooltip-content={JSON.stringify(response, null, 2)}
      >
        {getSimplifiedResponse()}
      </div>
    </div>
  );
}

export default ResponseDisplay;