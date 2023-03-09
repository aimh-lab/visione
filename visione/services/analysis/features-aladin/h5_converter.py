import argparse
from visione.savers import HDF5File
import h5py 

def main(args):
    with h5py.File(args.input, 'r') as h5fr:
        features = h5fr['features'][:]
        img_names = h5fr['image_names'][:]

    img_names = [n.decode() for n in img_names]
    n_images = features.shape[0]
    dimensionality = 768
    saver = HDF5File(args.output, shape=(n_images, dimensionality), flush_every=args.save_every, attrs={'features_name': 'aladin'})

    with saver:
        records = ({'_id': _id, 'feature': feature.tolist()} for _id, feature in zip(img_names, features))
        saver.add_many(records)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Converting aladin features in the appropriate H5 format')
    parser.add_argument('--save-every', type=int, default=100)
    parser.add_argument('--input', help="h5 input file")
    parser.add_argument('--output', default='h5 output file', help="h5 output file")
    args = parser.parse_args()

    main(args)
