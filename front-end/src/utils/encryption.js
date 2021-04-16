//import key
// import the entered key from the password input
function importSecretKey(password) {
  let enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
}

async function deriveEncryptionSecretKey(password, salt) {
  let keyMaterial = await importSecretKey(password);

  /*
  Given some key material and some random salt
  derive an AES-GCM key using PBKDF2.
  */
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

//file encryption function
export async function encryptFile(
  file,
  password,
  onStart = () => {},
  onFinish = () => {}
) {
  if (!file || !password) {
    throw new Error("File and password are required!");
  } else {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await deriveEncryptionSecretKey(password, salt); //requiring the key
    const fr = new FileReader(); //request a file read
    fr.readAsArrayBuffer(file); //read the file as buffer

    return new Promise((resolve, reject) => {
      fr.onloadstart = async () => {
        onStart();
      };

      fr.onload = async () => {
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); //generate a random iv
        const content = new Uint8Array(fr.result); //encoded file content
        // encrypt the file
        await window.crypto.subtle
          .encrypt(
            {
              iv,
              name: "AES-GCM",
            },
            derivedKey,
            content
          )
          .then(function (encrypted) {
            //returns an ArrayBuffer containing the encrypted data
            resolve(
              new Blob([iv, salt, new Uint8Array(encrypted)], {
                type: "application/octet-stream",
              })
            );
          })
          .catch(function () {
            reject("An error occured while Encrypting the file, try again!");
          });

        onFinish();
      };
    });
  }
}

//file decryption function
export async function decryptFile(
  file,
  password,
  onStart = () => {},
  onFinish = () => {}
) {
  if (!file || !password) {
    throw new Error("File and password are required!");
  } else {
    const fr = new FileReader(); //request a file read
    fr.readAsArrayBuffer(file); //read the file as buffer

    return new Promise((resolve, reject) => {
      fr.onloadstart = onStart;

      fr.onload = async () => {
        async function deriveDecryptionSecretKey() {
          //derive the secret key from a master key.

          let getSecretKey = await importSecretKey(password);

          return window.crypto.subtle.deriveKey(
            {
              name: "PBKDF2",
              salt: new Uint8Array(fr.result.slice(12, 28)), //get salt from encrypted file.
              iterations: 100000,
              hash: "SHA-256",
            },
            getSecretKey, //your key from importKey
            {
              //the key type you want to create based on the derived bits
              name: "AES-GCM",
              length: 256,
            },
            false, //whether the derived key is extractable
            ["encrypt", "decrypt"] //limited to the options encrypt and decrypt
          );
        }

        const derivedKey = await deriveDecryptionSecretKey(); //requiring the key

        const iv = new Uint8Array(fr.result.slice(0, 12)); //take out encryption iv

        const content = new Uint8Array(fr.result.slice(32)); //take out encrypted content

        await window.crypto.subtle
          .decrypt(
            {
              iv,
              name: "AES-GCM",
            },
            derivedKey,
            content
          )
          .then(function (decrypted) {
            //returns an ArrayBuffer containing the decrypted data
            resolve(
              new Blob([new Uint8Array(decrypted)], {
                type: "application/octet-stream",
              })
            );
          })
          .catch(function () {
            reject("You have entered a wrong Decryption Key!");
          });

        onFinish();
      };
    });
  }
}
