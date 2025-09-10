'use client';

export default function SimpleTest() {
  if (typeof window !== 'undefined') {
    console.log('🎉 SIMPLE CLIENT-SIDE RENDERED!');

    // Add an immediate script
    setTimeout(() => {
      console.log('🔥 SIMPLE CLIENT TIMEOUT WORKED!');
      document.body.style.backgroundColor = '#e0ffe0';
    }, 100);
  }

  return (
    <div>
      <h1>Simple JavaScript Test</h1>
      <p>If this page has a green background, JavaScript is working.</p>
      <script
        dangerouslySetInnerHTML={{
          __html: `
          console.log('🚀 SIMPLE INLINE SCRIPT EXECUTED');
          document.addEventListener('DOMContentLoaded', function() {
            console.log('🎯 SIMPLE DOM READY');
            document.body.style.border = '5px solid red';
          });
        `,
        }}
      />
    </div>
  );
}
