const forge = require("node-forge");
const fs = require("fs");

const caCrtPath = __dirname + "/certs/ca.crt";
const caKeyPath = __dirname + "/certs/ca.key";

const createCsr = () => {
  console.log("Generating 2048-bit key-pair...");
  const keys = forge.pki.rsa.generateKeyPair(2048);
  console.log("Key-pair created.");

  // openssl req -new -config ../openssl.cnf -key smime.key -out smime.csr
  // Note: Doesn't actually use .cnf, read in .key or output .csr; done in-memory
  // Note: Could skip creating a CSR here if you're the one generating the keys
  console.log("Creating certification request (CSR) ...");
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([
    {
      name: "commonName",
      value: "kimmo.proxy",
    },
    {
      name: "countryName",
      value: "FI",
    },
    {
      shortName: "ST",
      value: "Helsinki",
    },
    {
      name: "localityName",
      value: "Helsinki",
    },
    {
      name: "organizationName",
      value: "Test",
    },
    {
      shortName: "OU",
      value: "Test",
    },
  ]);

  // sign certification request
  csr.sign(keys.privateKey);
  console.log("Certification request (CSR) created.");

  // PEM-format keys and csr (for viewing or output as needed)
  const pem = {
    privateKey: forge.pki.privateKeyToPem(keys.privateKey),
    publicKey: forge.pki.publicKeyToPem(keys.publicKey),
    csr: forge.pki.certificationRequestToPem(csr),
  };

  return { csr, pem };
};

const signWithCA = csr => {
  console.log(`Reading ${caCrtPath}...`);
  const caCertPem = fs.readFileSync(caCrtPath, "utf8");
  console.log(`Reading ${caKeyPath}...`);
  const caKeyPem = fs.readFileSync(caKeyPath, "utf8");
  const caCert = forge.pki.certificateFromPem(caCertPem);
  const caKey = forge.pki.privateKeyFromPem(caKeyPem);

  console.log("Creating certificate...");
  const cert = forge.pki.createCertificate();
  // -set_serial 01
  cert.serialNumber = "01";
  // -days 365
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  // subject from CSR
  cert.setSubject(csr.subject.attributes);
  // issuer from CA
  cert.setIssuer(caCert.subject.attributes);
  // set appropriate extensions here (some examples below)
  cert.setExtensions([
    {
      name: "basicConstraints",
      cA: true,
    },
    {
      name: "keyUsage",
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: "subjectAltName",
      altNames: [
        {
          type: 2, // DNS
          value: "api.github.com",
        },
      ],
    },
  ]);
  cert.publicKey = csr.publicKey;

  // sign certificate with CA key
  cert.sign(caKey);
  console.log("Certificate created.");
  const pem = {
    publicKey: forge.pki.publicKeyToPem(cert.publicKey),
  };
  return { cert, pem };
};

const create = () => {
  const { csr, pem } = createCsr();
  /* console.log("\nServer Key-Pair:");
  console.log(pem.privateKey);
  console.log(pem.publicKey); */

  /* console.log("\nCertification Request (CSR):");
  console.log(pem.csr); */

  if (csr.verify()) {
    console.log("Certification request (CSR) verified.");
  } else {
    throw new Error("Signature not verified.");
  }

  const { cert } = signWithCA(csr);

  // console.log("\nSigned public key:");
  // console.log(serverPem.privateKey);
  // console.log(forge.pki.forge.pki.publicKeyToRSAPublicKey(cert.publicKey));
  // console.log(forge.pki.publicKeyToPem(cert.publicKey));

  const signedPem = forge.pki.certificateToPem(cert);

  return { privateKey: pem.privateKey, signedCrt: signedPem };
};

const main = () => {
  const { privateKey, signedCrt } = create();
  // These should match:
  // openssl rsa -noout -modulus -in server.key | openssl md5
  // openssl x509 -noout -modulus -in server.crt | openssl md5
  const privateKeyOutput = __dirname + "/certs/server.key";
  const publicCertOutput = __dirname + "/certs/server.crt";
  console.log(`Writing to ${privateKeyOutput}`);
  fs.writeFileSync(privateKeyOutput, privateKey);
  console.log(`Writing to ${publicCertOutput}`);
  fs.writeFileSync(publicCertOutput, signedCrt);
};

main();
