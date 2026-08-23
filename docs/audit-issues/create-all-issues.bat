@echo off
REM 2nothing 安全审计 Issues 批量创建脚本 (Windows)
REM 使用前确保已安装并登录 GitHub CLI: gh auth login

echo 🚀 开始创建 2nothing 安全审计 Issues...
echo.

REM 检查 gh CLI 是否已安装
where gh >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ GitHub CLI ^(gh^) 未安装
    echo 请访问 https://cli.github.com/ 下载安装
    pause
    exit /b 1
)

REM 检查是否已登录
gh auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未登录 GitHub CLI
    echo 请先运行: gh auth login
    pause
    exit /b 1
)

set SUCCESS=0
set FAILED=0

echo 📋 准备创建 5 个 Issues
echo.

REM Issue #1
echo 📝 创建: 🔴 硬编码的管理员密钥存在安全风险
if exist issue-01-hardcoded-admin-key.md (
    gh issue create --title "🔴 硬编码的管理员密钥存在安全风险" --label "priority: critical,security,bug" --body-file issue-01-hardcoded-admin-key.md >nul 2>&1
    if %errorlevel% equ 0 (
        echo    ✅ 成功
        set /a SUCCESS+=1
    ) else (
        echo    ❌ 失败
        set /a FAILED+=1
    )
) else (
    echo    ❌ 文件不存在
    set /a FAILED+=1
)
timeout /t 2 /nobreak >nul
echo.

REM Issue #2
echo 📝 创建: 🔴 速率限制fail open行为导致绕过风险
if exist issue-02-rate-limit-fail-open.md (
    gh issue create --title "🔴 速率限制fail open行为导致绕过风险" --label "priority: critical,security,bug" --body-file issue-02-rate-limit-fail-open.md >nul 2>&1
    if %errorlevel% equ 0 (
        echo    ✅ 成功
        set /a SUCCESS+=1
    ) else (
        echo    ❌ 失败
        set /a FAILED+=1
    )
) else (
    echo    ❌ 文件不存在
    set /a FAILED+=1
)
timeout /t 2 /nobreak >nul
echo.

REM Issue #3
echo 📝 创建: 🟡 API密钥恢复验证过于宽松
if exist issue-03-api-key-recovery-weak.md (
    gh issue create --title "🟡 API密钥恢复验证过于宽松" --label "priority: high,security,enhancement" --body-file issue-03-api-key-recovery-weak.md >nul 2>&1
    if %errorlevel% equ 0 (
        echo    ✅ 成功
        set /a SUCCESS+=1
    ) else (
        echo    ❌ 失败
        set /a FAILED+=1
    )
) else (
    echo    ❌ 文件不存在
    set /a FAILED+=1
)
timeout /t 2 /nobreak >nul
echo.

REM Issue #4
echo 📝 创建: 🟡 图片生成API缺少速率限制检查
if exist issue-04-image-generation-no-rate-limit.md (
    gh issue create --title "🟡 图片生成API缺少速率限制检查" --label "priority: high,security,bug" --body-file issue-04-image-generation-no-rate-limit.md >nul 2>&1
    if %errorlevel% equ 0 (
        echo    ✅ 成功
        set /a SUCCESS+=1
    ) else (
        echo    ❌ 失败
        set /a FAILED+=1
    )
) else (
    echo    ❌ 文件不存在
    set /a FAILED+=1
)
timeout /t 2 /nobreak >nul
echo.

REM Issue #6
echo 📝 创建: 🟡 认证逻辑在15+文件中重复
if exist issue-06-duplicate-auth-logic.md (
    gh issue create --title "🟡 认证逻辑在15+文件中重复" --label "priority: high,refactor,code-quality" --body-file issue-06-duplicate-auth-logic.md >nul 2>&1
    if %errorlevel% equ 0 (
        echo    ✅ 成功
        set /a SUCCESS+=1
    ) else (
        echo    ❌ 失败
        set /a FAILED+=1
    )
) else (
    echo    ❌ 文件不存在
    set /a FAILED+=1
)
echo.

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo 📊 创建完成！
echo    总计: 5
echo    成功: %SUCCESS% ✅
echo    失败: %FAILED% ❌
echo.

if %SUCCESS% gtr 0 (
    echo 🔗 查看所有 Issues:
    echo    https://github.com/hokithree7/2nothing/issues
)

if %FAILED% gtr 0 (
    echo.
    echo ⚠️  部分 Issues 创建失败，请检查:
    echo    1. 是否有权限访问仓库
    echo    2. 标签是否已存在
    echo    3. 网络连接是否正常
)

echo.
echo ✨ 建议下一步:
echo    1. 查看并验证创建的 Issues
echo    2. 创建项目看板进行管理
echo    3. 按优先级分配给 Argo
echo.

pause
