export interface ClonedReel {
  id: string;
  userEmail: string;
  sourceUrl: string;
  subjectTitle: string;
  previewUrl: string;
  originalPreviewUrl: string;
  audioOption: 'original' | 'custom';
  createdAt: string;
  status: 'completed' | 'processing' | 'failed';
  resolution: string;
  fps: number;
}

export interface UserAccount {
  email: string;
  credits: number;
  createdAt: string;
}

// In-memory data store for the application
class DataStore {
  private users: Map<string, UserAccount> = new Map();
  private reels: ClonedReel[] = [];

  constructor() {
    // Seed default client account with 2 free credits and sample reels
    const defaultEmail = 'client@brand.com';
    this.users.set(defaultEmail, {
      email: defaultEmail,
      credits: 2,
      createdAt: new Date().toISOString(),
    });

    this.reels.push(
      {
        id: 'reel-101',
        userEmail: defaultEmail,
        sourceUrl: 'https://www.instagram.com/reel/C8xYz1_s1000rr',
        subjectTitle: 'Royal Enfield Continental GT 650',
        previewUrl: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&auto=format&fit=crop&q=80',
        originalPreviewUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&auto=format&fit=crop&q=80',
        audioOption: 'original',
        createdAt: 'Today, 7:15 PM',
        status: 'completed',
        resolution: '1080x1920',
        fps: 60,
      },
      {
        id: 'reel-102',
        userEmail: defaultEmail,
        sourceUrl: 'https://www.instagram.com/reel/C7mK90_bmw_m4',
        subjectTitle: 'BMW M4 Competition Cinematic',
        previewUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=600&auto=format&fit=crop&q=80',
        originalPreviewUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop&q=80',
        audioOption: 'original',
        createdAt: 'Yesterday, 3:42 PM',
        status: 'completed',
        resolution: '1080x1920',
        fps: 60,
      },
      {
        id: 'reel-103',
        userEmail: defaultEmail,
        sourceUrl: 'https://www.instagram.com/reel/C6pQ42_jordan_reels',
        subjectTitle: 'Nike Air Jordan Sneaker Reel',
        previewUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
        originalPreviewUrl: 'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=600&auto=format&fit=crop&q=80',
        audioOption: 'custom',
        createdAt: '24 Oct 2026',
        status: 'completed',
        resolution: '1080x1920',
        fps: 60,
      }
    );
  }

  getUser(email: string): UserAccount {
    let user = this.users.get(email.toLowerCase());
    if (!user) {
      user = {
        email: email.toLowerCase(),
        credits: 2, // 2 free starter credits for new signups
        createdAt: new Date().toISOString(),
      };
      this.users.set(email.toLowerCase(), user);
    }
    return user;
  }

  addCredits(email: string, amount: number): UserAccount {
    const user = this.getUser(email);
    user.credits += amount;
    this.users.set(email.toLowerCase(), user);
    return user;
  }

  deductCredit(email: string): boolean {
    const user = this.getUser(email);
    if (user.credits <= 0) {
      return false;
    }
    user.credits -= 1;
    this.users.set(email.toLowerCase(), user);
    return true;
  }

  getUserReels(email: string): ClonedReel[] {
    return this.reels.filter((r) => r.userEmail.toLowerCase() === email.toLowerCase());
  }

  saveReel(reel: ClonedReel): ClonedReel {
    this.reels.unshift(reel);
    return reel;
  }
}

// Global singleton to persist across Next.js API hot-reloads
const globalForStore = global as unknown as { store: DataStore };
export const store = globalForStore.store || new DataStore();
if (process.env.NODE_ENV !== 'production') globalForStore.store = store;
