// Part of phpstorm-theme-generator — see LICENSE.
/**
 * Minimal ZIP writer (stored, no compression) — no dependencies.
 *
 * Handles string or Uint8Array bodies and directory entries, so it can build a
 * real .jar and nest it inside the distribution .zip. That nesting matters:
 * PhpStorm's "Install Plugin from Disk" wants <name>/lib/<name>.jar with
 * META-INF/plugin.xml *inside the jar*. A zip of a source tree gives you
 * "Fail to load plugin descriptor".
 */

const CRC_TABLE=(()=>{const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}
  return t;})();
export function crc32(buf){let c=0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) c=CRC_TABLE[(c^buf[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;}

const U16=v=>[v&0xff,(v>>8)&0xff];
const U32=v=>[v&0xff,(v>>8)&0xff,(v>>16)&0xff,(v>>>24)&0xff];

/* files: [{path, body?}] — a path ending in "/" is a directory entry. */
export function zipBytes(files){
  const enc=new TextEncoder();
  const chunks=[],central=[];
  let offset=0;

  for(const f of files){
    const isDir=f.path.endsWith('/');
    const name=enc.encode(f.path);
    const data=isDir?new Uint8Array(0)
      :(typeof f.body==='string'?enc.encode(f.body):f.body);
    const crc=isDir?0:crc32(data);
    const extAttr=isDir?0x41ED0010:0x81A40000;

    const local=new Uint8Array([...U32(0x04034b50),...U16(20),...U16(0),...U16(0),
      ...U16(0),...U16(0x2821),...U32(crc),...U32(data.length),...U32(data.length),
      ...U16(name.length),...U16(0)]);
    chunks.push(local,name);
    if(data.length) chunks.push(data);

    central.push(new Uint8Array([...U32(0x02014b50),...U16(0x0314),...U16(20),...U16(0),
      ...U16(0),...U16(0),...U16(0x2821),...U32(crc),...U32(data.length),...U32(data.length),
      ...U16(name.length),...U16(0),...U16(0),...U16(0),...U16(0),
      ...U32(extAttr),...U32(offset)]),name);

    offset+=local.length+name.length+data.length;
  }

  let cdSize=0; for(const c of central) cdSize+=c.length;
  const end=new Uint8Array([...U32(0x06054b50),...U16(0),...U16(0),
    ...U16(central.length/2),...U16(central.length/2),...U32(cdSize),...U32(offset),...U16(0)]);

  let total=offset+cdSize+end.length;
  const out=new Uint8Array(total); let o=0;
  for(const c of [...chunks,...central,end]){ out.set(c,o); o+=c.length; }
  return out;
}
export const makeZip=files=>new Blob([zipBytes(files)],{type:'application/zip'});
