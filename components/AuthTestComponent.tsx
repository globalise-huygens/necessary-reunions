'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/shared/Button';

export function AuthTestComponent() {
  const { data: session, status } = useSession();
  const [testResult, setTestResult] = useState<string>('');

  const testAnnotationUpdate = async () => {
    if (!session) {
      setTestResult('No session found - authentication required');
      return;
    }

    try {
      setTestResult('🔄 Testing annotation update...');

      // Test annotation update API
      const testAnnotation = {
        '@context': 'http://www.w3.org/ns/anno.jsonld',
        id: 'test-annotation-id',
        type: 'Annotation',
        motivation: 'textspotting',
        body: [
          {
            type: 'TextualBody',
            value: 'Test updated text',
            format: 'text/plain',
            purpose: 'supplementing',
            generator: {
              id: 'https://hdl.handle.net/10622/X2JZYY',
              type: 'Software',
              label:
                'GLOBALISE Loghi Handwritten Text Recognition Model - August 2023',
            },
          },
        ],
        target: {
          source: 'test-canvas-id',
          selector: {
            type: 'SvgSelector',
            value: '<svg></svg>',
          },
        },
      };

      const response = await fetch('/api/annotations/test-annotation-name', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testAnnotation),
      });

      if (response.status === 401) {
        setTestResult('Authentication failed - user not authorized');
      } else if (response.status === 404) {
        setTestResult(
          '✅ Authentication working! (404 expected for test annotation)',
        );
      } else {
        const result = await response.text();
        setTestResult(
          `✅ Authentication working! Response: ${
            response.status
          } - ${result.substring(0, 100)}...`,
        );
      }
    } catch (error: any) {
      setTestResult(`Test failed: ${error.message}`);
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Authentication Test</h3>

      <div className="space-y-2 mb-4">
        <p>
          <strong>Status:</strong> {status}
        </p>
        {session && (
          <>
            <p>
              <strong>User:</strong> {(session.user as any)?.label}
            </p>
            <p>
              <strong>ORCID:</strong> {(session.user as any)?.id}
            </p>
          </>
        )}
      </div>

      <Button onClick={testAnnotationUpdate} disabled={status === 'loading'}>
        Test Annotation Update API
      </Button>

      {testResult && (
        <div className="mt-4 p-3 bg-white rounded border">
          <p className="text-sm">{testResult}</p>
        </div>
      )}
    </div>
  );
}
