//! Independent packaging/CI verification using the same audited Minisign verifier as Launcher.
use base64::{engine::general_purpose::STANDARD,Engine};
use minisign_verify::{PublicKey,Signature};
use sha2::{Digest,Sha256};
use std::{fs,path::Path};
fn verify(bytes:&[u8],signature:&str,version:&str)->Result<(),String>{
 let decode=|s:&str|STANDARD.decode(s.trim()).ok().and_then(|v|String::from_utf8(v).ok()).ok_or("Invalid signature encoding");
 let key=PublicKey::decode(&decode(include_str!("../../../integrations/chopik-launcher/trust/bordena.pub"))?).map_err(|_|"Invalid pinned public key")?;
 let sig=Signature::decode(&decode(signature)?).map_err(|_|"Invalid artifact signature")?;
 key.verify(bytes,&sig,true).map_err(|_|"Signature mismatch")?;
 let signed=sig.trusted_comment().split('\t').find_map(|p|p.strip_prefix("version:")).ok_or("No authenticated signature version")?;
 if signed!=version{return Err("Authenticated version differs".into())} Ok(())
}
fn run(metadata:&Path,installer:&Path,version:&str)->Result<(),String>{
 let v=semver::Version::parse(version).map_err(|_|"Expected machine SemVer")?;
 if v.major==0||!v.pre.is_empty()||!v.build.is_empty(){return Err("Expected Stable version >= 1.0.0".into())}
 if fs::metadata(metadata).map_err(|_|"Metadata missing")?.len()>256*1024{return Err("Oversized metadata".into())}
 let envelope:serde_json::Value=serde_json::from_slice(&fs::read(metadata).map_err(|_|"Cannot read metadata")?).map_err(|_|"Invalid envelope")?;
 let payload=envelope["payload"].as_str().ok_or("Missing payload")?;verify(payload.as_bytes(),envelope["signature"].as_str().ok_or("Missing envelope signature")?,version)?;
 let r:serde_json::Value=serde_json::from_str(payload).map_err(|_|"Invalid payload JSON")?;
 if r["version"]!=version || r["schema_version"]!=1 || r["product_id"]!="team.chopik.bordena" || r["platform"]!="windows-x86_64" || r["channel"]!="stable" {return Err("Release identity/version/platform/channel differs".into())}
 let url=r["url"].as_str().ok_or("Missing URL")?;let prefix=format!("https://github.com/chopik-team/Bordena/releases/download/v{version}/");
 if !url.starts_with(&prefix)||!url.ends_with("-Windows-x64-Setup.exe")||url[prefix.len()..].contains(['/', '%','?','#']){return Err("Unexpected package URL".into())}
 let size=r["size"].as_u64().ok_or("Missing package size")?;
 if size==0||size>512*1024*1024||fs::metadata(installer).map_err(|_|"Installer missing")?.len()!=size{return Err("Package size mismatch".into())}
 let bytes=fs::read(installer).map_err(|_|"Cannot read installer")?;
 if r["sha256"]!=format!("{:x}",Sha256::digest(&bytes)){return Err("Package SHA-256 mismatch".into())}
 verify(&bytes,r["installer_signature"].as_str().ok_or("Missing package signature")?,version)
}
fn main(){let args:Vec<_>=std::env::args().collect();let result=if args.len()==4{run(Path::new(&args[1]),Path::new(&args[2]),&args[3])}else{Err("Expected metadata.json installer.exe machine-version".into())};match result{Ok(())=>println!("PASS: pinned signatures, version, URL, size and SHA-256"),Err(e)=>{eprintln!("Release verification rejected: {e}");std::process::exit(1)}}}
