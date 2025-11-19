import type { NextPage, GetStaticProps } from "next";
import Head from "next/head";
import dynamic from "next/dynamic";

import cloudinary from "../utils/cloudinary";
import getBase64ImageUrl from "../utils/generateBlurPlaceholder";
import type { ImageProps } from "../utils/types";

const FindYourselfClient = dynamic(
  () => import("../components/FindYourselfClient"),
  { ssr: false },
);

type Props = {
  images: ImageProps[];
};

const FindYourselfPage: NextPage<Props> = ({ images }) => {
  return (
    <>
      <Head>
        <title>Find Yourself – Next.js Conf 2022 Photos</title>
      </Head>
      <FindYourselfClient images={images} />
    </>
  );
};

export default FindYourselfPage;

export const getStaticProps: GetStaticProps = async () => {
  const results = await cloudinary.v2.search
    .expression(`folder:${process.env.CLOUDINARY_FOLDER}/*`)
    .sort_by("public_id", "desc")
    .max_results(200)
    .execute();

  let reducedResults: ImageProps[] = [];
  let i = 0;
  for (let result of results.resources) {
    reducedResults.push({
      id: i,
      height: result.height,
      width: result.width,
      public_id: result.public_id,
      format: result.format,
    });
    i++;
  }

  const blurImagePromises = results.resources.map((image: ImageProps) =>
    getBase64ImageUrl(image),
  );
  const imagesWithBlurDataUrls = await Promise.all(blurImagePromises);

  for (let i = 0; i < reducedResults.length; i++) {
    reducedResults[i].blurDataUrl = imagesWithBlurDataUrls[i];
  }

  return {
    props: {
      images: reducedResults,
    },
  };
};
