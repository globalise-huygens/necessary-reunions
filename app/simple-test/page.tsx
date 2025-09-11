'use client';

export default function SimpleTest() {
  if (typeof window !== 'undefined') {
    // Add an immediate script
    setTimeout(() => {
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
          document.addEventListener('DOMContentLoaded', function() {
            document.body.style.border = '5px solid red';
          });
        `,
        }}
      />
    </div>
  );
}
