import { useParams } from 'wouter';

export const Editor = () => {
  const params = useParams();
  const projectIri = params.projectIri;
  return (
    <>
      <p>TODO: Editor for {projectIri}</p>
    </>
  );
};
