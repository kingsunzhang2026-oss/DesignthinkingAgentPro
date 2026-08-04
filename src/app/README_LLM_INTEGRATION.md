# 📚 LLM 集成文档索引

欢迎使用 Designthinking Agent Pro 的 LLM API 集成功能！

本文档库包含了完整的使用说明、技术文档和故障排查指南。

## 🎯 开始使用

### 新手入门（推荐）

👉 **[快速开始指南](./QUICK_START.md)** - 5 分钟快速上手  
最适合第一次使用的用户，提供最简洁的配置和使用步骤。

### 完整功能说明

📖 **[LLM 集成说明](./LLM_INTEGRATION_README.md)** - 详细使用文档  
包含：
- 功能特性详解
- 使用步骤说明
- 技术架构介绍
- API 使用示例
- 性能优化建议

## 🔧 问题解决

### 遇到问题？

🔍 **[故障排查指南](./TROUBLESHOOTING.md)** - 常见问题 Q&A  
包含：
- WASM 错误诊断
- API 密钥问题
- 文档上传问题
- 性能优化
- 调试工具使用

## 📊 技术文档

### 开发者参考

🛠️ **[集成总结](./INTEGRATION_SUMMARY.md)** - 技术实现详情  
包含：
- 完整的代码结构
- 设计原则和架构
- API 调用流程
- 安全考虑
- 性能指标

### 部署和发布

🚀 **[部署检查清单](./DEPLOYMENT_CHECKLIST.md)** - 上线前必读  
包含：
- 功能测试清单
- 代码质量检查
- 性能测试
- 安全检查
- 回滚计划

## 📁 文件结构概览

### 核心服务文件

```
/services/
├── llm.ts              # DeepSeek API 集成服务
├── documents.ts        # 文档处理和解析
├── aiScenarios.ts      # AI 场景生成逻辑
├── debug.ts            # 调试和监控工具
└── test.ts             # 测试工具套件
```

### UI 组件文件

```
/components/
├── ErrorBoundary.tsx                 # 错误边界（新增）
├── SettingsModal.tsx                 # 设置页面（已更新）
└── panels/
    └── ContextPanel.tsx              # 情境节点（已更新）
```

### 文档文件

```
/
├── QUICK_START.md                    # 快速开始
├── LLM_INTEGRATION_README.md         # 完整说明
├── TROUBLESHOOTING.md                # 故障排查
├── INTEGRATION_SUMMARY.md            # 技术总结
├── DEPLOYMENT_CHECKLIST.md           # 部署清单
└── README_LLM_INTEGRATION.md         # 本文档
```

## 🎓 学习路径

### 路径 1：用户视角（5 分钟）

1. 阅读 [快速开始](./QUICK_START.md)
2. 获取 API 密钥
3. 配置并测试
4. 生成第一个场景 ✨

### 路径 2：深度使用（15 分钟）

1. 阅读 [快速开始](./QUICK_START.md)
2. 阅读 [完整说明](./LLM_INTEGRATION_README.md)
3. 上传知识库文档
4. 优化场景生成质量

### 路径 3：开发者视角（30 分钟）

1. 阅读 [集成总结](./INTEGRATION_SUMMARY.md)
2. 查看代码实现
3. 运行测试套件
4. 了解架构设计

### 路径 4：故障排查（视情况而定）

1. 遇到问题时查看 [故障排查](./TROUBLESHOOTING.md)
2. 运行诊断工具
3. 查看相关文档的具体章节
4. 必要时联系支持

## 🔑 关键功能速查

### API 密钥管理

```typescript
// 在 /services/llm.ts 中
saveApiKey(key: string)     // 保存密钥
getApiKey()                 // 获取密钥
hasApiKey()                 // 检查密钥
testApiKey(key)             // 测试密钥
clearApiKey()               // 清除密钥
```

**位置：** 左侧设置 → API 密钥 (DeepSeek)

### 文档处理

```typescript
// 在 /services/documents.ts 中
extractDocumentContent(file)          // 提取单个文档
extractMultipleDocuments(files)       // 批量提取
mergeDocumentContents(documents)      // 合并内容
```

**位置：** 左侧设置 → AI 知识库

### AI 场景生成

```typescript
// 在 /services/aiScenarios.ts 中
generateScenarios(
  deviceName: string,
  knowledgeBase: DocumentContent[],
  onProgress?: (message: string) => void
)
```

**位置：** 右侧面板 → 情境扩展节点 → AI 模拟长尾场景

### 调试工具

```javascript
// 在浏览器控制台中
__llmTests.health()         // 健康检查
__llmTests.all()            // 运行所有测试
__llmTests.apiKey()         // 测试 API 密钥
__llmTests.scenario()       // 测试场景生成
```

**位置：** 浏览器控制台（F12）

## 💡 最佳实践

### 文档管理

- ✅ 使用 TXT 或 MD 格式
- ✅ 单个文档 < 5MB
- ✅ 总文档数 < 10 个
- ❌ 避免上传大型 PDF/DOCX

### 场景生成

- ✅ 使用具体的设备名称
- ✅ 上传相关参考文档
- ✅ 多次生成选最佳
- ❌ 避免频繁调用 API

### 安全建议

- ✅ 定期更新 API 密钥
- ✅ 不在公共设备保存密钥
- ✅ 不上传敏感信息
- ❌ 不分享 API 密钥

## 🆘 获取帮助

### 自助资源

1. **文档搜索**
   - 使用 Ctrl+F 在文档中搜索关键词
   - 查看相关章节

2. **诊断工具**
   - 运行 `__llmTests.health()` 健康检查
   - 查看控制台错误信息

3. **故障排查**
   - 查看 [故障排查指南](./TROUBLESHOOTING.md)
   - 按照步骤逐一排查

### 联系支持

如果以上方法都无法解决问题：

1. 收集以下信息：
   - 错误截图
   - 控制台日志
   - 操作步骤
   - 浏览器版本

2. 联系开发团队并提供上述信息

## 📊 功能对比

### 集成前 vs 集成后

| 功能 | 集成前 | 集成后 |
|-----|--------|--------|
| 场景生成 | Mock 数据 | 真实 AI 生成 |
| 知识库 | 仅上传 | 提取内容并使用 |
| 场景质量 | 固定模板 | 基于设备和文档生成 |
| 自定义 | 有限 | 完全自定义 |
| 长尾场景 | 预设 | 动态生成 |

## 🎉 成功案例

### 典型使用场景

1. **医疗器械设计验证**
   - 输入：设备名称 + 国标文档
   - 输出：2-3 个符合标准的长尾场景

2. **人机交互测试**
   - 输入：设备名称 + 设计规范
   - 输出：考虑人因工程的场景

3. **快速原型验证**
   - 输入：设备名称
   - 输出：多样化的测试场景

## 🔄 版本信息

**当前版本：** v1.0.0  
**发布日期：** 2024-12-22  
**状态：** ✅ 稳定版

### 更新日志

**v1.0.0 (2024-12-22)**
- ✅ 集成 DeepSeek API
- ✅ 实现 API 密钥管理
- ✅ 支持文档上传和解析
- ✅ AI 场景生成功能
- ✅ 错误处理和调试工具
- ✅ 完整文档和测试套件

## 📈 后续计划

### 短期计划

- [ ] 支持更多 LLM 提供商
- [ ] 流式输出的实时显示
- [ ] 场景生成的自定义参数
- [ ] 批量场景生成

### 长期计划

- [ ] 后端 PDF 解析服务
- [ ] 向量数据库集成
- [ ] 场景生成历史记录
- [ ] 导出场景报告

## 🙏 致谢

感谢所有贡献者和测试人员的支持！

---

## 快速链接

- 🚀 [5 分钟快速开始](./QUICK_START.md)
- 📖 [完整使用文档](./LLM_INTEGRATION_README.md)
- 🔧 [故障排查指南](./TROUBLESHOOTING.md)
- 🛠️ [技术实现详情](./INTEGRATION_SUMMARY.md)
- ✅ [部署检查清单](./DEPLOYMENT_CHECKLIST.md)

---

**祝你使用愉快！** 🎊

有任何问题或建议，欢迎反馈！
