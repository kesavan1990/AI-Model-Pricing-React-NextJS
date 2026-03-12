'use client';

export function Toast({ message, type = 'success', show }) {
  if (!show) return <div id="toast" className="toast hidden" />;
  return (
    <div id="toast" className={'toast ' + (type || 'success')} role="alert">
      {message}
    </div>
  );
}
