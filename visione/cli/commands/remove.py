import shutil

from .command import BaseCommand


class RemoveCommand(BaseCommand):
    """ Implements the 'remove' CLI command. """

    def __init__(self, *args, **kwargs):
        super(RemoveCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('remove', help='Removes one or more videos from the collection.')
        parser.add_argument('--purge', action='store_true', default=False, help='Purge also content and analyses.')
        parser.add_argument('video_ids', nargs='+', help='ID(s) of video(s) to be removed.')
        parser.set_defaults(func=self)

    def __call__(self, *, config_file, video_ids, purge):
        super(RemoveCommand, RemoveCommand).__call__(self, config_file)

        nondata_folders = ['logs', 'logs_dres']
        data_folders = [x for x in self.collection_dir.iterdir() if x.is_dir() and x.name not in nondata_folders]

        if purge:
            # remove content and analyses files
            for video_id in video_ids:
                print('Purging:', video_id)

                # analyses, intermediate files
                for data_dir in data_folders:
                    video_dir = data_dir / video_id
                    if video_dir.exists():
                        shutil.rmtree(video_dir, ignore_errors=True)

                # video content
                for size in ('medium', 'tiny'):
                    (self.collection_dir / 'resized-videos' / size / f'{video_id}-{size}.mp4').unlink(missing_ok=True)

                # FIXME: the video extension is unknown, we assume mp4 here, but we should smartly glob.
                (self.collection_dir / 'videos' / f'{video_id}.mp4').unlink(missing_ok=True)


        self.remove_from_lucene_index(video_ids)

        indexed_features = self.config.get('index', {}).get('features', {})
        faiss_features = [k for k, v in indexed_features.items() if v['index_engine'] == 'faiss']
        for features_name in faiss_features:
            self.remove_from_faiss_index(video_ids, features_name)

    def remove_from_lucene_index(self, video_ids):
        """ Removes all the frames of one or more videos from the Lucene collection index.

        Args:
            video_ids (list of str): IDs of videos to be removed.

        Returns:
            # TODO
        """

        lucene_index_dir = self.collection_dir / 'lucene-index'
        lucene_index_dir = '/data' / lucene_index_dir.relative_to(self.collection_dir)

        service = 'lucene-index-manager'
        command = [
            # 'java', '-jar', 'lucene-index-manager.jar',  # this is already in the ENTRYPOINT
            str(lucene_index_dir),
            'remove',
        ] + video_ids

        return self.compose_run(service, command)
    
    def remove_from_faiss_index(self, video_ids, features_name):
        """ Removes frames of one or more videos from the FAISS index dedicated to the given type of features.

        Args:
            video_ids (list of str): IDs of videos to be removed.
            features_name (str): Name of the features in the index. This will be used to select the index for these features.

        Returns:
            # TODO
        """

        faiss_index_file = self.collection_dir / f'faiss-index_{features_name}.faiss'
        faiss_idmap_file = self.collection_dir / f'faiss-idmap_{features_name}.txt'

        faiss_index_file = '/data' / faiss_index_file.relative_to(self.collection_dir)
        faiss_idmap_file = '/data' / faiss_idmap_file.relative_to(self.collection_dir)
        config_file = '/data' / self.config_file.relative_to(self.collection_dir)

        service = 'faiss-index-manager'
        command = [
            'python', 'build.py',
            '--config-file', str(config_file),
            str(faiss_index_file),
            str(faiss_idmap_file),
            'remove'
        ] + video_ids

        return self.compose_run(service, command)