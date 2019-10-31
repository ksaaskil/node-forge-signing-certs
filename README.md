# Creating server certificates with [forge](https://github.com/digitalbazaar/forge)

## Instructions

### Install dependencies

```bash
yarn
```

### Generate CA with `openssl`

Create `ca.key`:

```bash
openssl genrsa -out ca.key 2048
```

Create `ca.crt`:

```bash
openssl req -x509 -new -nodes -key ca.key -subj "/CN=${DOMAIN}" -days 10000 -out ca.crt
```

### Generate server certificates signed by CA

```bash
node index.js
```
