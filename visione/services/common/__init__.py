import yaml


def load_config(yaml_path):
    # load config file
    with open(yaml_path, 'r') as yaml_file:
        config = yaml.safe_load(yaml_file)

    # fill default URL values
    def _fill_null(dictionary, fill_value):
        for k, v in dictionary.items():
            if v is None:
                dictionary[k] = fill_value

    _fill_null(config['static_files_urls'], 'http://router')
    _fill_null(config['services_urls'], 'http://router')

    return config


class CliProgress(object):
    """ Progress bar for CLI. """
    def __init__(self, initial=0, total=-1):
        super(CliProgress, self).__init__()
        self.initial = initial
        self.total = -1 if total is None else total

    def __call__(self, iterable):

        def _wrapped(iterable):
            print(f'progress: {self.initial}/{self.total}', flush=True)
            for it in iterable:
                yield it
                self.initial += 1
                print(f'progress: {self.initial}/{self.total}', flush=True)

            if self.total < 0:
                self.total = self.initial
            print(f'progress: {self.initial}/{self.total}', flush=True)

        return _wrapped(iterable)


def cli_progress(iterable, initial=0, total=-1):
    return CliProgress(initial, total)(iterable)