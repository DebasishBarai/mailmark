import React from "react";
import { Composition } from "remotion";
import { MailmarkVideo } from "./MailmarkVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MailmarkPromo"
        component={MailmarkVideo}
        durationInFrames={1620}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{}}
      />
    </>
  );
};
