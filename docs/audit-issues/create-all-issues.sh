#!/bin/bash

# 2nothing 安全审计 Issues 批量创建脚本
# 使用前确保已安装并登录 GitHub CLI: gh auth login

echo "🚀 开始创建 2nothing 安全审计 Issues..."
echo ""

# 检查 gh CLI 是否已安装
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) 未安装"
    echo "请访问 https://cli.github.com/ 下载安装"
    exit 1
fi

# 检查是否已登录
if ! gh auth status &> /dev/null; then
    echo "❌ 未登录 GitHub CLI"
    echo "请先运行: gh auth login"
    exit 1
fi

# 定义所有 Issues
# 格式: "文件名:标题:标签"
declare -a ISSUES=(
    "issue-01-hardcoded-admin-key.md:🔴 硬编码的管理员密钥存在安全风险:priority: critical,security,bug"
    "issue-02-rate-limit-fail-open.md:🔴 速率限制fail open行为导致绕过风险:priority: critical,security,bug"
    "issue-03-api-key-recovery-weak.md:🟡 API密钥恢复验证过于宽松:priority: high,security,enhancement"
    "issue-04-image-generation-no-rate-limit.md:🟡 图片生成API缺少速率限制检查:priority: high,security,bug"
    "issue-06-duplicate-auth-logic.md:🟡 认证逻辑在15+文件中重复:priority: high,refactor,code-quality"
)

# 统计
TOTAL=${#ISSUES[@]}
SUCCESS=0
FAILED=0

echo "📋 准备创建 $TOTAL 个 Issues"
echo ""

# 遍历创建
for issue_data in "${ISSUES[@]}"; do
    IFS=':' read -r file title labels <<< "$issue_data"
    
    echo "📝 创建: $title"
    
    if [ ! -f "$file" ]; then
        echo "   ❌ 文件不存在: $file"
        ((FAILED++))
        continue
    fi
    
    if gh issue create \
        --title "$title" \
        --label "$labels" \
        --body-file "$file" > /dev/null 2>&1; then
        echo "   ✅ 成功"
        ((SUCCESS++))
    else
        echo "   ❌ 失败"
        ((FAILED++))
    fi
    
    # 避免 API 速率限制
    sleep 2
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 创建完成！"
echo "   总计: $TOTAL"
echo "   成功: $SUCCESS ✅"
echo "   失败: $FAILED ❌"
echo ""

if [ $SUCCESS -gt 0 ]; then
    echo "🔗 查看所有 Issues:"
    echo "   https://github.com/hokithree7/2nothing/issues"
fi

if [ $FAILED -gt 0 ]; then
    echo ""
    echo "⚠️  部分 Issues 创建失败，请检查:"
    echo "   1. 是否有权限访问仓库"
    echo "   2. 标签是否已存在"
    echo "   3. 网络连接是否正常"
fi

echo ""
echo "✨ 建议下一步:"
echo "   1. 查看并验证创建的 Issues"
echo "   2. 创建项目看板进行管理"
echo "   3. 按优先级分配给 Argo"
echo ""
