# AnnoRepo

We are using AnnoRepo, a W3C Web Annotation Data Model (W3C Web Annotation) compliant annotation repository, to store the annotations. For more information: https://github.com/knaw-huc/annorepo, and API documentation: https://github.com/knaw-huc/annorepo/blob/main/docs/api-usage.md

- [AnnoRepo](#annorepo)
  - [Initial setup](#initial-setup)
    - [Container](#container)
      - [Creating the container](#creating-the-container)
      - [Adding multiple users to edit the container](#adding-multiple-users-to-edit-the-container)
    - [Queries](#queries)


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

### Queries

WIP
