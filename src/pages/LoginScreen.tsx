import { useEffect, useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth } from '@/lib/firebase';

const SHARED_EMAIL = 'jamsil@preppers.com';

function getFriendlyAuthError(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code ?? '')
      : '';

  if (code.includes('operation-not-allowed')) {
    return 'Firebase Authentication에서 이메일/비밀번호 로그인이 아직 켜져 있지 않습니다.';
  }

  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return '로그인 정보가 맞지 않습니다. Firebase Authentication > Users에서 계정을 다시 확인해주세요.';
  }

  if (code.includes('unauthorized-domain')) {
    return '현재 접속한 도메인이 Firebase 허용 목록에 없습니다. Authentication > Settings > Authorized domains에 도메인을 추가해주세요.';
  }

  return '로그인에 실패했습니다. Firebase 콘솔 설정을 다시 확인해주세요.';
}

export default function LoginScreen() {
  const [email, setEmail] = useState(SHARED_EMAIL);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmail(SHARED_EMAIL);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (caught) {
      setError(getFriendlyAuthError(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">공용 계정 로그인</p>
          <h1 className="text-2xl font-bold text-foreground">오더 헬퍼 로그인</h1>
          <p className="text-sm text-muted-foreground">
            회원가입 없이 이메일과 비밀번호로 바로 로그인합니다.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">
              이메일
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jamsil@preppers.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm">
              비밀번호
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>
      </div>
    </div>
  );
}
