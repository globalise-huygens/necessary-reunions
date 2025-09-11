export default function JavaScriptTest() {
  return (
    <html>
      <head>
        <title>JavaScript Execution Test</title>
      </head>
      <body>
        <h1>JavaScript Execution Test</h1>
        <div id="test-output">JavaScript NOT executed</div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
            document.getElementById('test-output').innerText = 'JavaScript IS WORKING!';
            document.getElementById('test-output').style.color = 'green';
            document.getElementById('test-output').style.fontWeight = 'bold';

            // Test setTimeout
            setTimeout(() => {
              document.body.style.backgroundColor = '#e8f5e8';
            }, 1000);
          `,
          }}
        />

        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.addEventListener('load', () => {
              const div = document.createElement('div');
              div.innerText = 'DOM manipulation works!';
              div.style.color = 'blue';
              div.style.marginTop = '20px';
              document.body.appendChild(div);
            });
          `,
          }}
        />
      </body>
    </html>
  );
}
