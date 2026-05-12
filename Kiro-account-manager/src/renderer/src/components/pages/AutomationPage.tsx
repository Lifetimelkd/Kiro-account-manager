import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '../ui'
import { useAccountsStore } from '@/store/accounts'
import { useTranslation } from '@/hooks/useTranslation'
import { Bot, CheckCircle2, Cpu, KeyRound, Loader2, Mail, RefreshCw, Sparkles, TriangleAlert, Wand2 } from 'lucide-react'

interface AutomationLogItem {
  type: 'info' | 'success' | 'error'
  text: string
}

interface SelfCheckResult {
  success?: boolean
  registerDir?: string
  pythonCmd?: string
  bridgePath?: string
  bridgeExists?: boolean
  bridgeResult?: {
    success?: boolean
    ok?: boolean
    python?: string
    checks?: Array<{ name: string; ok: boolean; error?: string }>
    error?: string
  }
  error?: string
}

export function AutomationPage(): React.ReactNode {
  const { accounts, addAccount } = useAccountsStore()
  const { t } = useTranslation()
  const isEn = t('common.unknown') === 'Unknown'

  const [batchCount, setBatchCount] = useState('1')
  const [headless, setHeadless] = useState(true)
  const [autoSubscribe, setAutoSubscribe] = useState(false)
  const [mailProvider, setMailProvider] = useState('shiromail')
  const [mailUrl, setMailUrl] = useState('')
  const [mailKey, setMailKey] = useState('')
  const [mailDomainId, setMailDomainId] = useState('')
  const [yesCaptchaKey, setYesCaptchaKey] = useState('')
  const [cdkCode, setCdkCode] = useState('')
  const [subscriptionType, setSubscriptionType] = useState('')
  const [googleEmail, setGoogleEmail] = useState('')
  const [googlePassword, setGooglePassword] = useState('')
  const [googleTotpSecret, setGoogleTotpSecret] = useState('')
  const [googleClearSession, setGoogleClearSession] = useState(true)
  const [googleAutoLogin, setGoogleAutoLogin] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isCheckingEnv, setIsCheckingEnv] = useState(false)
  const [selfCheck, setSelfCheck] = useState<SelfCheckResult | null>(null)
  const [logs, setLogs] = useState<AutomationLogItem[]>([])

  const selectedAccounts = useMemo(() => Array.from(accounts.values()), [accounts])

  const pushLog = (type: AutomationLogItem['type'], text: string): void => {
    setLogs(prev => [...prev, { type, text }])
  }

  const handleSelfCheck = async (): Promise<void> => {
    setIsCheckingEnv(true)
    try {
      const result = await window.api.automationSelfCheck() as SelfCheckResult
      setSelfCheck(result)
    } finally {
      setIsCheckingEnv(false)
    }
  }

  useEffect(() => {
    handleSelfCheck()
  }, [])

  const handleBatchRegister = async (): Promise<void> => {
    setIsRegistering(true)
    setLogs([])
    try {
      const result = await window.api.automationRegisterBatch({
        count: Number(batchCount) || 1,
        headless,
        autoSubscribe,
        mailProvider,
        mailUrl,
        mailKey,
        mailDomainId,
        yescaptchaKey: yesCaptchaKey,
        cdkCode,
        subscriptionType
      }) as {
        success?: boolean
        results?: Array<{
          success?: boolean
          email?: string
          password?: string
          userId?: string
          accessToken?: string
          refreshToken?: string
          clientId?: string
          clientSecret?: string
          region?: string
          subscriptionTitle?: string
          subscriptionType?: string
          overageEnabled?: boolean
          error?: string
        }>
        error?: string
      }

      if (!result?.success) {
        pushLog('error', result?.error || (isEn ? 'Batch register failed' : '批量注册失败'))
        return
      }

      for (const item of result.results || []) {
        if (item.success && item.email && item.refreshToken) {
          const now = Date.now()
          addAccount({
            email: item.email,
            userId: item.userId || '',
            nickname: item.email.split('@')[0],
            idp: 'BuilderId',
            credentials: {
              accessToken: item.accessToken || '',
              csrfToken: '',
              refreshToken: item.refreshToken,
              clientId: item.clientId || '',
              clientSecret: item.clientSecret || '',
              region: item.region || 'us-east-1',
              expiresAt: now + 3600 * 1000,
              authMethod: 'IdC',
              provider: 'BuilderId'
            },
            subscription: {
              type: (item.subscriptionType || 'Free') as 'Free' | 'Pro' | 'Pro_Plus' | 'Enterprise' | 'Teams',
              title: item.subscriptionTitle || item.subscriptionType || 'Free'
            },
            usage: {
              current: 0,
              limit: 0,
              percentUsed: 0,
              lastUpdated: now,
              resourceDetail: {
                overageEnabled: item.overageEnabled || false
              }
            },
            tags: [],
            status: 'active',
            lastUsedAt: now
          })
          pushLog('success', `${item.email} ${isEn ? 'imported' : '已导入'}`)
        } else {
          pushLog('error', item.error || (isEn ? 'Unknown register error' : '未知注册错误'))
        }
      }
    } catch (error) {
      pushLog('error', error instanceof Error ? error.message : (isEn ? 'Batch register failed' : '批量注册失败'))
    } finally {
      setIsRegistering(false)
    }
  }

  const handleBatchSubscribe = async (): Promise<void> => {
    setIsSubscribing(true)
    setLogs([])
    try {
      const result = await window.api.automationSubscribeBatch({
        accounts: selectedAccounts.map(account => ({
          id: account.id,
          email: account.email,
          accessToken: account.credentials.accessToken,
          refreshToken: account.credentials.refreshToken,
          clientId: account.credentials.clientId,
          clientSecret: account.credentials.clientSecret,
          region: account.credentials.region,
          provider: account.credentials.provider,
          profileArn: account.profileArn
        })),
        yescaptchaKey: yesCaptchaKey,
        cdkCode,
        subscriptionType
      }) as {
        success?: boolean
        results?: Array<{ email?: string; success?: boolean; paymentUrl?: string; error?: string }>
        error?: string
      }

      if (!result?.success) {
        pushLog('error', result?.error || (isEn ? 'Batch subscribe failed' : '批量订阅失败'))
        return
      }

      for (const item of result.results || []) {
        if (item.success) {
          pushLog('success', `${item.email || 'Unknown'}: ${item.paymentUrl || (isEn ? 'subscribed' : '订阅完成')}`)
        } else {
          pushLog('error', `${item.email || 'Unknown'}: ${item.error || (isEn ? 'failed' : '失败')}`)
        }
      }
    } catch (error) {
      pushLog('error', error instanceof Error ? error.message : (isEn ? 'Batch subscribe failed' : '批量订阅失败'))
    } finally {
      setIsSubscribing(false)
    }
  }

  const handleGoogleLogin = async (): Promise<void> => {
    setIsGoogleLoggingIn(true)
    setLogs([])
    try {
      const result = await window.api.automationGoogleLogin({
        headless,
        autoLogin: googleAutoLogin,
        clearSession: googleClearSession,
        googleEmail,
        googlePassword,
        googleTotpSecret
      }) as {
        success?: boolean
        result?: {
          email?: string
          userId?: string
          accessToken?: string
          refreshToken?: string
          clientId?: string
          clientSecret?: string
          region?: string
          provider?: string
          authMethod?: string
        }
        error?: string
      }

      if (!result?.success || !result.result?.refreshToken) {
        pushLog('error', result?.error || (isEn ? 'Google login failed' : 'Google 登录失败'))
        return
      }

      const item = result.result
      const now = Date.now()
      addAccount({
        email: item.email || googleEmail,
        userId: item.userId || '',
        nickname: (item.email || googleEmail || 'google').split('@')[0],
        idp: 'Google',
        credentials: {
          accessToken: item.accessToken || '',
          csrfToken: '',
          refreshToken: item.refreshToken || '',
          clientId: item.clientId || '',
          clientSecret: item.clientSecret || '',
          region: item.region || 'us-east-1',
          expiresAt: now + 3600 * 1000,
          authMethod: (item.authMethod === 'social' ? 'social' : 'IdC') as 'IdC' | 'social',
          provider: ((item.provider === 'Github' || item.provider === 'BuilderId' || item.provider === 'Enterprise' || item.provider === 'IAM_SSO') ? item.provider : 'Google') as 'BuilderId' | 'Github' | 'Google' | 'Enterprise' | 'IAM_SSO'
        },
        subscription: {
          type: 'Free',
          title: 'Free'
        },
        usage: {
          current: 0,
          limit: 0,
          percentUsed: 0,
          lastUpdated: now,
          resourceDetail: {
            overageEnabled: false
          }
        },
        tags: [],
        status: 'active',
        lastUsedAt: now
      })
      pushLog('success', `${item.email || googleEmail} ${isEn ? 'logged in and imported' : '已登录并导入'}`)
    } catch (error) {
      pushLog('error', error instanceof Error ? error.message : (isEn ? 'Google login failed' : 'Google 登录失败'))
    } finally {
      setIsGoogleLoggingIn(false)
    }
  }

  return (
    <div className="h-full overflow-auto px-6 py-5">
      <div className="max-w-6xl space-y-6">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-amber-500/10 p-6">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute left-20 bottom-0 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-primary/15 shadow-sm">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-primary">{isEn ? 'Automation Center' : '自动化中心'}</h1>
                <Badge className="border-0 bg-primary/15 text-primary hover:bg-primary/15">
                  {isEn ? 'Manager Native UI' : 'Manager 原生样式'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-3xl">
                {isEn
                  ? 'Register-side capabilities are exposed here with manager-native cards, status surfaces, and form hierarchy.'
                  : '这里把 register 侧的自动化能力按 manager 的界面语言重新组织，统一卡片、状态反馈和表单层级。'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="xl:col-span-2 overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-primary/5 via-primary/0 to-emerald-500/5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    <span>{isEn ? 'Environment Check' : '环境自检'}</span>
                  </CardTitle>
                  <CardDescription>{isEn ? 'Verify Python bridge and runtime dependencies before executing automation.' : '执行自动化前先验证 Python bridge 和运行依赖。'}</CardDescription>
                </div>
                <Button variant="outline" onClick={handleSelfCheck} disabled={isCheckingEnv}>
                  {isCheckingEnv ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  {isEn ? 'Recheck' : '重新检测'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {selfCheck ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{isEn ? 'Python Runtime' : 'Python 运行时'}</div>
                      <div className="font-mono text-xs break-all text-foreground/90">{selfCheck.bridgeResult?.python || selfCheck.pythonCmd || '-'}</div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{isEn ? 'Bridge File' : '桥接脚本'}</div>
                      <div className="font-mono text-xs break-all text-foreground/90">{selfCheck.bridgePath || '-'}</div>
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{isEn ? 'Execution Status' : '执行状态'}</div>
                      <div className="flex items-center gap-2">
                        {selfCheck.bridgeResult?.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <TriangleAlert className="h-4 w-4 text-red-500" />}
                        <span className={selfCheck.bridgeResult?.ok ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                          {selfCheck.bridgeResult?.ok ? (isEn ? 'Ready' : '可运行') : (isEn ? 'Not Ready' : '不可运行')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {(selfCheck.error || selfCheck.bridgeResult?.error) && (
                    <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600">
                      {selfCheck.error || selfCheck.bridgeResult?.error}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {(selfCheck.bridgeResult?.checks || []).map((item) => (
                      <div key={item.name} className="rounded-xl border bg-background p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-mono text-xs break-all">{item.name}</div>
                          <Badge className={item.ok ? 'border-0 bg-green-500/10 text-green-600 hover:bg-green-500/10' : 'border-0 bg-red-500/10 text-red-500 hover:bg-red-500/10'}>
                            {item.ok ? 'OK' : 'FAIL'}
                          </Badge>
                        </div>
                        {!item.ok && item.error && (
                          <div className="text-xs text-muted-foreground break-all leading-relaxed">{item.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{isEn ? 'Checking environment...' : '正在检测环境...'}</div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>{isEn ? 'Batch Register' : '批量注册'}</span>
              </CardTitle>
              <CardDescription>{isEn ? 'Use register automation, but keep the manager visual system.' : '复用 register 自动化能力，但界面遵循 manager 的视觉规范。'}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isEn ? 'Count' : '数量'}</Label>
                  <Input value={batchCount} onChange={(e) => setBatchCount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Mail Provider' : '邮件服务商'}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['shiromail', 'tempforward'].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setMailProvider(item)}
                        className={`rounded-xl border px-3 py-2 text-sm text-left transition-all ${mailProvider === item ? 'border-primary bg-primary/8 text-primary shadow-sm' : 'border-border bg-background hover:border-primary/40'}`}
                      >
                        <div className="font-medium">{item === 'shiromail' ? 'ShiroMail' : 'TempForward'}</div>
                        <div className="text-xs text-muted-foreground mt-1">{item === 'shiromail' ? 'API key + domain based' : 'Temporary forward mailbox'}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>{isEn ? 'Mail URL' : '邮件服务 URL'}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" value={mailUrl} onChange={(e) => setMailUrl(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Mail Key' : '邮件 Key'}</Label>
                  <Input value={mailKey} onChange={(e) => setMailKey(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Domain ID' : '域名 ID'}</Label>
                  <Input value={mailDomainId} onChange={(e) => setMailDomainId(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHeadless(!headless)}
                  className={`rounded-xl border p-4 text-left transition-all ${headless ? 'border-primary bg-primary/8' : 'hover:border-primary/30'}`}
                >
                  <div className="font-medium text-sm">{isEn ? 'Headless Browser' : '无头浏览器'}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isEn ? 'Run Playwright without opening visible browser windows.' : '使用 Playwright 执行，但不弹出可见浏览器窗口。'}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoSubscribe(!autoSubscribe)}
                  className={`rounded-xl border p-4 text-left transition-all ${autoSubscribe ? 'border-primary bg-primary/8' : 'hover:border-primary/30'}`}
                >
                  <div className="font-medium text-sm">{isEn ? 'Auto Subscribe' : '自动订阅'}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isEn ? 'Continue into subscription flow after successful registration.' : '注册成功后继续进入订阅流程。'}</div>
                </button>
              </div>

              <Button onClick={handleBatchRegister} disabled={isRegistering || !selfCheck?.bridgeResult?.ok} className="w-full sm:w-auto">
                {isRegistering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                {isEn ? 'Start Batch Register' : '开始批量注册'}
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-sky-500/8 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-sky-600" />
                <span>{isEn ? 'Google Auto Login' : 'Google 自动登录'}</span>
              </CardTitle>
              <CardDescription>{isEn ? 'Use customer-provided Google email, password, and TOTP secret to complete Google login and import the account.' : '使用客户提供的 Google 邮箱、密码和 TOTP Secret 自动完成 Google 登录并导入账号。'}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>{isEn ? 'Google Email' : 'Google 邮箱'}</Label>
                  <Input value={googleEmail} onChange={(e) => setGoogleEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'Google Password' : 'Google 密码'}</Label>
                  <Input type="password" value={googlePassword} onChange={(e) => setGooglePassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'TOTP Secret' : 'TOTP Secret'}</Label>
                  <Input type="password" value={googleTotpSecret} onChange={(e) => setGoogleTotpSecret(e.target.value)} placeholder={isEn ? 'Base32 secret or otpauth URL' : 'Base32 密钥或 otpauth URL'} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGoogleClearSession(!googleClearSession)}
                  className={`rounded-xl border p-4 text-left transition-all ${googleClearSession ? 'border-primary bg-primary/8' : 'hover:border-primary/30'}`}
                >
                  <div className="font-medium text-sm">{isEn ? 'Clear Old Session' : '清理旧会话'}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isEn ? 'Delete previous cached sign-in state before Google login.' : '在 Google 登录前清理本地旧的登录缓存状态。'}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleAutoLogin(!googleAutoLogin)}
                  className={`rounded-xl border p-4 text-left transition-all ${googleAutoLogin ? 'border-primary bg-primary/8' : 'hover:border-primary/30'}`}
                >
                  <div className="font-medium text-sm">{isEn ? 'Inject Local Token' : '注入本地 Token'}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isEn ? 'Persist token into local cache after successful login.' : '登录成功后把 token 写入本地缓存。'}</div>
                </button>
              </div>

              <Button onClick={handleGoogleLogin} disabled={isGoogleLoggingIn || !googleEmail || !googlePassword || !selfCheck?.bridgeResult?.ok} className="w-full sm:w-auto">
                {isGoogleLoggingIn ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                {isEn ? 'Start Google Auto Login' : '开始 Google 自动登录'}
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-amber-500/8 to-transparent">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-600" />
                <span>{isEn ? 'Batch Subscribe Pro' : '批量订阅 Pro'}</span>
              </CardTitle>
              <CardDescription>{isEn ? 'Operate against accounts already stored in manager.' : '对 manager 中已存在的账号批量执行订阅流程。'}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>{isEn ? 'Subscription Type' : '订阅类型'}</Label>
                  <Input placeholder="KIRO_PRO" value={subscriptionType} onChange={(e) => setSubscriptionType(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'YesCaptcha Key' : 'YesCaptcha Key'}</Label>
                  <Input value={yesCaptchaKey} onChange={(e) => setYesCaptchaKey(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{isEn ? 'CDK Code' : 'CDK 码'}</Label>
                  <Input value={cdkCode} onChange={(e) => setCdkCode(e.target.value)} />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">{isEn ? 'Target Pool' : '目标账号池'}</div>
                <div className="flex items-center gap-2">
                  <Badge className="border-0 bg-primary/10 text-primary hover:bg-primary/10">
                    {selectedAccounts.length}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{isEn ? 'accounts currently available in manager' : '当前 manager 中可用于订阅的账号数'}</span>
                </div>
              </div>

              <Button onClick={handleBatchSubscribe} disabled={isSubscribing || selectedAccounts.length === 0 || !selfCheck?.bridgeResult?.ok} className="w-full sm:w-auto">
                {isSubscribing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {isEn ? 'Start Batch Subscribe' : '开始批量订阅'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-slate-500/5 to-transparent">
            <CardTitle>{isEn ? 'Execution Logs' : '执行日志'}</CardTitle>
            <CardDescription>{isEn ? 'Unified feedback surface for register-side automation results.' : '统一展示 register 侧自动化执行反馈，而不是原始控制台样式。'}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="rounded-2xl bg-muted/30 border min-h-56 max-h-[420px] overflow-auto p-4 font-mono text-xs space-y-2">
              {logs.length === 0 ? (
                <div className="text-muted-foreground">{isEn ? 'No logs yet' : '暂无日志'}</div>
              ) : logs.map((log, index) => (
                <div key={index} className={`rounded-lg px-3 py-2 ${log.type === 'error' ? 'bg-red-500/8 text-red-500' : log.type === 'success' ? 'bg-green-500/8 text-green-600' : 'bg-background text-foreground/90'}`}>
                  {log.text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
