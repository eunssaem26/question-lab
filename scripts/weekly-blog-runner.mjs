// launchd(com.eunssaem.weekly-blog)가 weekly-blog.sh 대신 이 파일을 실행한다.
// 이유: Desktop은 macOS 보호 폴더라 launchd가 띄운 /bin/zsh는 접근이 거부된다(TCC).
// node 바이너리는 이미 디스크 접근 권한이 있으므로(dashboard·link-digest 작업과 동일),
// node를 책임 프로세스로 세우고 그 아래에서 zsh 스크립트를 돌린다.
import { execFileSync } from 'node:child_process';

execFileSync(
  '/bin/zsh',
  ['/Users/eunssaem/Desktop/open claw 준비/scripts/weekly-blog.sh'],
  { stdio: 'inherit' },
);
