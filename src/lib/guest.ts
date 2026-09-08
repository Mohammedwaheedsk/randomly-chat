const STORAGE_KEY = 'omegle_guest_id';
const NICKNAME_KEY = 'omegle_nickname';

export function generateGuestId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Stranger_${num}`;
}

export function getGuestId(): string {
  let id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateGuestId();
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function clearGuestId(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(NICKNAME_KEY);
}

export function getNickname(): string | null {
  return sessionStorage.getItem(NICKNAME_KEY);
}

export function setNickname(name: string): void {
  sessionStorage.setItem(NICKNAME_KEY, name);
}
