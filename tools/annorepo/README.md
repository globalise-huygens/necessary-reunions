# AnnoRepo

We are using AnnoRepo, a W3C Web Annotation Data Model (W3C Web Annotation) compliant annotation repository, to store the annotations. For more information: https://github.com/knaw-huc/annorepo, and API documentation: https://github.com/knaw-huc/annorepo/blob/main/docs/api-usage.md

- [AnnoRepo](#annorepo)
  - [Initial setup](#initial-setup)
    - [Container](#container)
      - [Creating the container](#creating-the-container)
      - [Adding multiple users to edit the container](#adding-multiple-users-to-edit-the-container)
    - [Adding annotations](#adding-annotations)
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

### Adding annotations
The AnnoRepo API allows for adding annotations in bulk. The following example shows how to add all annotations from a static AnnotationPage json file to the container. 

**Request**

<!-- POST https://annorepo.globalise.huygens.knaw.nl/services/necessary-reunions/annotations-batch HTTP/1.1
Content-Type: application/json -->

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

WIP
