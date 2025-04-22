// import { NextResponse } from "next/server"
// import fs from "fs"
// import path from "path"

// export async function GET(request: Request, { params }: { params: { id: string } }) {
//   try {
//     const id = params.id

//     // Validate the ID to prevent directory traversal attacks
//     if (!id || id.includes("..") || !id.match(/^[A-Za-z0-9_-]+$/)) {
//       return NextResponse.json({ error: "Invalid ID parameter" }, { status: 400 })
//     }

//     // Define the path to the georeferencing file
//     const filePath = path.join(process.cwd(), "public", "iiif", "annotations", "georeferencing", `${id}.json`)

//     // Check if the file exists
//     if (!fs.existsSync(filePath)) {
//       console.error(`Georeferencing file not found at: ${filePath}`)
//       return NextResponse.json({ error: "Georeferencing file not found" }, { status: 404 })
//     }

//     // Read the file
//     const fileContent = fs.readFileSync(filePath, "utf8")

//     // Parse the JSON to validate it
//     const jsonData = JSON.parse(fileContent)

//     // Return the georeferencing data with proper headers
//     return NextResponse.json(jsonData, {
//       headers: {
//         "Content-Type": "application/json",
//         "Access-Control-Allow-Origin": "*",
//       },
//     })
//   } catch (error) {
//     console.error("Error serving georeferencing data:", error)
//     return NextResponse.json(
//       { error: `Failed to serve georeferencing data: ${error instanceof Error ? error.message : String(error)}` },
//       { status: 500 },
//     )
//   }
// }
