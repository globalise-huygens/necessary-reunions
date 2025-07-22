# AnnoRepo

We are using AnnoRepo, a W3C Web Annotation Data Model (W3C Web Annotation) compliant annotation repository, to store the annotations. For more information: https://github.com/knaw-huc/annorepo, and API documentation: https://github.com/knaw-huc/annorepo/blob/main/docs/api-usage.md

- [AnnoRepo](#annorepo)
  - [Initial setup](#initial-setup)
    - [Container](#container)
      - [Creating the container](#creating-the-container)
      - [Adding multiple users to edit the container](#adding-multiple-users-to-edit-the-container)
    - [Adding annotations](#adding-annotations)
    - [Queries](#queries)
      - [A custom query per target](#a-custom-query-per-target)
      - [A custom query per target and filtering on motivation/purpose](#a-custom-query-per-target-and-filtering-on-motivationpurpose)


## Initial setup

Instance URL: `https://annorepo.globalise.huygens.knaw.nl`

### Container
Our annotations are in a separate annotation container: `necessary-reunions`

#### Creating the container

**Request**

```bash
curl -X POST \
     -H "Accept: application/ld+json; profile=\"http://www.w3.org/ns/anno.jsonld\"" \
     -H "Content-Type: application/ld+json; profile=\"http://www.w3.org/ns/anno.jsonld\"" \
     -H "Authorization: Bearer ACCESS_TOKEN" \
     -H "Slug: necessary-reunions" \
     -d '{
  "@context": [
    "http://www.w3.org/ns/anno.jsonld",
    "http://www.w3.org/ns/ldp.jsonld"
  ],
  "type": [
    "BasicContainer",
    "AnnotationCollection"
  ],
  "label": "Annotation Container for the Necessary Reunions Project",
  "readOnlyForAnonymousUsers": true
}' \
     https://annorepo.globalise.huygens.knaw.nl/w3c/
```

**Response**

```json
{
  "@context": [
    "http://www.w3.org/ns/anno.jsonld",
    "http://www.w3.org/ns/ldp.jsonld"
  ],
  "id": "https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/",
  "type": [
    "BasicContainer",
    "AnnotationCollection"
  ],
  "total": 0,
  "label": "Annotation Container for the Necessary Reunions Project",
  "first": {
    "id": "https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/?page=0",
    "type": "AnnotationPage",
    "partOf": "https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/",
    "startIndex": 0,
    "items": []
  },
  "last": "https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/?page=0"
}
```

#### Adding multiple users to edit the container

**Request**

```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ACCESS_TOKEN" \
     -d '[
  { "userName": "user1", "role": "EDITOR" },
  { "userName": "user2", "role": "ADMIN" },
  { "userName": "user3", "role": "ADMIN" }
]' \
     https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/users
```

**Response**

```json
[
  {
    "userName": "user1",
    "role": "EDITOR"
  },
  {
    "userName": "user2",
    "role": "ADMIN"
  },
  {
    "userName": "user3",
    "role": "ADMIN"
  }
]
```

### Adding annotations
The AnnoRepo API allows for adding annotations in bulk. The following example shows how to add all annotations from a static AnnotationPage json file to the container. 

**Request**

```bash
jq '.items' scripts/textspotting/results/NL-HaNA_4.MIKO_W23.json | curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ACCESS_TOKEN" \
     -d @- \
     https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/annotations-batch
```

**Response**

```json
[
  {
    "annotationName": "d860951d-8f6b-4561-b7c8-623eed85ffa5",
    "containerName": "necessary-reunions",
    "etag": "1852994547"
  },
  ... much more
  {
    "annotationName": "14d67da8-c317-4637-b9cd-58cb95d39793",
    "containerName": "necessary-reunions",
    "etag": "537476272"
  }
]
```

### Queries

#### A custom query per target

We make a query that gives back all annotations for a given target. Since a target can be defined in multiple ways (referenced/embedded), we have to define multiple conditions:
 1. Directly referenced target (the value is the uri of the target)
 2. Embedded target with id (the value is a nested object where the uri is in the `id` key)
 3. Source target (the value is a nested object where the uri is in the `source` key)
 4. Source target with id (the value is a nested object where the uri is in the `source.id` key) 

**Request**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ACCESS_TOKEN" \
      -d '{
        "name": "with-target",
        "query": {
            ":or": [
                { "target": "<target>" },
                { "target.id": "<target>" },
                { "target.source": "<target>" },
                { "target.source.id": "<target>" }
              ]
        },        
        "label": "target=<target>",
        "description": "This custom query returns those annotations where the target is the given value",
        "public": true
    }' \
     https://annorepo.globalise.huygens.knaw.nl/global/custom-query
```

Once set, we can call the custom query and the target parameter like this:

* https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target:target= + base64 encoded Canvas URI. 
* Example: https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target:target=aHR0cHM6Ly9kYXRhLmdsb2JhbGlzZS5odXlnZW5zLmtuYXcubmwvbWFuaWZlc3RzL21hcHMvNC5NSUtPL0lJSS9JSUkuMS9JSUkuMS41L1czNy5qc29uL2NhbnZhcy9wMQ==

#### A custom query per target and filtering on motivation/purpose

We can also filter on the motivation/purpose of the annotation. The following example shows how to filter on the `textspotting` purpose.

**Request**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer ACCESS_TOKEN" \
      -d '{
        "name": "with-target-and-motivation-or-purpose",
        "query": {
            ":or": [
                { "target": "<target>" },
                { "target.id": "<target>" },
                { "target.source": "<target>" },
                { "target.source.id": "<target>" }
              ],
            ":or": [
                { "motivation": "<motivationorpurpose>" },
                { "body.purpose": "<motivationorpurpose>" }
              ]
        },        
        "label": "target=<target>, motivation/purpose=<motivationorpurpose>",
        "description": "This custom query returns those annotations where the target is the given value and the motivationorpurpose is the given value",
        "public": true
    }' \
     https://annorepo.globalise.huygens.knaw.nl/global/custom-query
```

Once set, we can call the custom query and the target parameter like this:

* https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target-and-motivation-or-purpose:target= + base64 encoded Canvas URI, motivationorpurpose= + base64 encoded motivation/purpose.
* Example: https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/custom-query/with-target-and-motivation-or-purpose:target=aHR0cHM6Ly9kYXRhLmdsb2JhbGlzZS5odXlnZW5zLmtuYXcubmwvbWFuaWZlc3RzL21hcHMvNC5NSUtPL0lJSS9JSUkuMS9JSUkuMS41L1czNy5qc29uL2NhbnZhcy9wMQ==,motivationorpurpose=dGV4dHNwb3R0aW5n
