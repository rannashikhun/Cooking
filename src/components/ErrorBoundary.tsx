import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] px-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 p-7 text-center space-y-4 shadow-sm">
            <h1 className="text-xl font-bold text-[#1A1A1A]">
              পৃষ্ঠাটি লোড করতে সাময়িক সমস্যা হয়েছে
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ করুন। সমস্যা থাকলে ব্রাউজার ক্যাশ পরিষ্কার করে আবার চেষ্টা করুন।
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-[#1B4D24] hover:bg-[#143A1B] text-white text-sm font-bold cursor-pointer"
            >
              পুনরায় লোড করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
