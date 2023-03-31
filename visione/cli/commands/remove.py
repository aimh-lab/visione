import re
import shutil
import subprocess

from rich.status import Status

from .command import BaseCommand


class RemoveCommand(BaseCommand):
    """ Implements the 'remove' CLI command. """

    def __init__(self, *args, **kwargs):
        super(RemoveCommand, self).__init__(*args, **kwargs)

    def add_arguments(self, subparsers):
        parser = subparsers.add_parser('remove', help='Removes one or more videos from the collection indices.')
        parser.add_argument('--content', action='store_true', default=False, help='Remove also static contents (videos, selected frames, thumbs).')
        parser.add_argument('--analysis', action='store_true', default=False, help='Remove also analyses.')
        parser.add_argument('video_ids', nargs='+', help='ID(s) of video(s) to be removed.')
        parser.set_defaults(func=self)

    def __call__(self, *, video_ids, content, analysis, **kwargs):
        super(RemoveCommand, RemoveCommand).__call__(self, **kwargs)

        status = Status('Removing ...')
        status.start()

        logs_folders = ('logs', 'logs_dres')
        content_folders = ('videos', 'resized-videos', 'selected-frames', 'thumbnails')
        non_analysis_folders = content_folders + logs_folders

        analysis_folders = [x for x in self.collection_dir.iterdir() if x.is_dir() and x.name not in non_analysis_folders]
        logs_folders     = [self.collection_dir / d for d in logs_folders]
        content_folders  = [self.collection_dir / d for d in content_folders]

        if analysis:  # remove analyses, intermediate files
            status.update('Removing files (analysis) ...')
            for video_id in video_ids:
                for data_dir in analysis_folders:
                    video_dir = data_dir / video_id
                    if video_dir.exists():
                        shutil.rmtree(video_dir, ignore_errors=True)

            status.console.log('Analysis files deleted.')

        if content:  # remove content files
            status.update('Removing files (content) ...')
            for video_id in video_ids:
                for data_dir in content_folders:
                    video_dir = data_dir / video_id
                    if video_dir.exists():
                        shutil.rmtree(video_dir, ignore_errors=True)

                for size in ('medium', 'tiny'):
                    (self.collection_dir / 'resized-videos' / size / f'{video_id}-{size}.mp4').unlink(missing_ok=True)

                # find the video file (it can have any extension)
                escaped_video_id = re.escape(video_id)
                candidates = (self.collection_dir / 'videos').glob(f'{video_id}.*')
                candidates = [c for c in candidates if re.match(rf'{escaped_video_id}\.[0-9a-zA-Z]+', c.name)]

                if len(candidates) == 1:
                    candidates[0].unlink(missing_ok=True)
                else:
                    status.console.log(f"WARNING: multiple video file found for '{video_id}'. Skipping removal.")

            status.console.log('Content files deleted.')

        status.update('Removing (Lucene) ...')
        self.remove_from_lucene_index(video_ids, stderr_callback=status.console.print)
        status.console.log('Removed from Lucene.')

        indexed_features = self.config.get('index', {}).get('features', {})
        faiss_features = [k for k, v in indexed_features.items() if v['index_engine'] == 'faiss']
        if faiss_features:
            status.update('Removing (FAISS) ...')

            for features_name in faiss_features:
                self.remove_from_faiss_index(video_ids, features_name, stderr_callback=status.console.print)

            status.console.log('Removed from FAISS.')

        for video_id in video_ids:
            status.console.log(f"- '{video_id}' removed.")

        status.stop()

    def remove_from_lucene_index(self, video_ids, **run_kws):
        """ Removes all the frames of one or more videos from the Lucene collection index.

        Args:
            video_ids (list of str): IDs of videos to be removed.
            run_kws (dict): Keyword arguments to be passed to `subprocess.Popen()`.

        Returns:
            int: Return code of the Lucene index manager.
        """

        lucene_index_dir = self.collection_dir / 'lucene-index'
        lucene_index_dir = '/data' / lucene_index_dir.relative_to(self.collection_dir)

        service = 'lucene-index-manager'
        command = [
            # 'java', '-jar', 'lucene-index-manager.jar',  # this is already in the ENTRYPOINT
            str(lucene_index_dir),
            'remove',
        ] + video_ids

        return self.compose_run(service, command, **run_kws)

    def remove_from_faiss_index(self, video_ids, features_name, **run_kws):
        """ Removes frames of one or more videos from the FAISS index dedicated to the given type of features.

        Args:
            video_ids (list of str): IDs of videos to be removed.
            features_name (str): Name of the features in the index. This will be used to select the index for these features.
            run_kws (dict): Keyword arguments to be passed to `subprocess.Popen()`.

        Returns:
            int: Return code of the FAISS index manager.
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

        return self.compose_run(service, command, **run_kws)