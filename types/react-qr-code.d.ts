declare module 'react-qr-code' {
  import * as React from 'react';
  interface QRCodeProps extends React.SVGProps<SVGSVGElement> {
    value: string;
  }
  export default function QRCode(props: QRCodeProps): JSX.Element;
}
