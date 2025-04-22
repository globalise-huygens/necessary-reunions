export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")

  if (!url) {
    return new Response(JSON.stringify({ error: "URL parameter is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }

  try {
    console.log(`Proxy: Fetching ${url}`)

    // Add timeout to the fetch request
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, application/ld+json",
      },
      cache: "no-store",
      next: { revalidate: 0 },
    })
    clearTimeout(timeoutId)

    console.log(`Proxy: Response status ${response.status}`)

    if (!response.ok) {
      console.error(`Proxy: Error response from ${url}: ${response.status}`)
      return new Response(
        JSON.stringify({
          error: `Failed to fetch from source: HTTP ${response.status}`,
          status: response.status,
          url: url,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    const contentType = response.headers.get("content-type")
    console.log(`Proxy: Content-Type: ${contentType}`)

    // Check if the response is JSON
    if (contentType && !contentType.includes("json") && !contentType.includes("application/ld+json")) {
      console.warn(`Proxy: Non-JSON content type: ${contentType}`)
    }

    try {
      // Try to parse as JSON to validate
      const data = await response.json()

      // Return the data with appropriate headers
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    } catch (parseError) {
      console.error("Proxy: Failed to parse JSON:", parseError)
      return new Response(
        JSON.stringify({
          error: "The source URL did not return valid JSON",
          url: url,
        }),
        {
          status: 422,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }
  } catch (error) {
    console.error("Proxy error:", error)

    let errorMessage = "Failed to fetch from source"
    if (error.name === "AbortError") {
      errorMessage = "Request timed out"
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        url: url,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
