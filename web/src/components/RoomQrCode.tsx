import { useMemo } from 'react';
import * as QRCode from 'qrcode';

type RoomQrCodeProps = {
  value: string;
  label: string;
  asLink?: boolean;
};

type QrState =
  | {
      ok: true;
      path: string;
      viewBoxSize: number;
    }
  | {
      ok: false;
      message: string;
    };

const QUIET_ZONE = 4;

function createQrPath(modules: QRCode.BitMatrix) {
  const commands: string[] = [];
  const size = modules.size;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules.get(row, col)) {
        commands.push(`M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
      }
    }
  }

  return commands.join('');
}

export function RoomQrCode({ value, label, asLink = true }: RoomQrCodeProps) {
  const qrState = useMemo<QrState>(() => {
    try {
      const matrix = QRCode.create(value, { errorCorrectionLevel: 'H' });
      return {
        ok: true,
        path: createQrPath(matrix.modules),
        viewBoxSize: matrix.modules.size + QUIET_ZONE * 2
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'QR code unavailable.'
      };
    }
  }, [value]);

  if (!qrState.ok) {
    return <p className='room-qr-fallback'>{qrState.message}</p>;
  }

  const qrSvg = (
    <svg className='room-qr-code' viewBox={`0 0 ${qrState.viewBoxSize} ${qrState.viewBoxSize}`} aria-hidden='true' shapeRendering='crispEdges'>
      <rect width={qrState.viewBoxSize} height={qrState.viewBoxSize} rx='1.5' fill='#ffffff' />
      <path d={qrState.path} fill='#06152d' />
    </svg>
  );

  if (!asLink) {
    return (
      <div className='room-qr-link' aria-label={label}>
        {qrSvg}
      </div>
    );
  }

  return (
    <a className='room-qr-link' href={value} aria-label={label}>
      {qrSvg}
    </a>
  );
}
